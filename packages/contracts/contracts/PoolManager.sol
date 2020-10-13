pragma solidity 0.5.16;

import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/IPool.sol';
import './Interfaces/IPoolManager.sol';
import './Interfaces/ICDPManager.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ICLVToken.sol';
import "./Interfaces/IGTStaking.sol";
import './Dependencies/Math.sol';
import './Dependencies/SafeMath.sol';
import './Dependencies/SafeMath128.sol';
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

// PoolManager maintains all pools 
contract PoolManager is Ownable, IPoolManager {
    using SafeMath for uint;
    using SafeMath128 for uint128;

    // --- Connected contract declarations ---

    IBorrowerOperations public borrowerOperations;
    address public borrowerOperationsAddress;

    address public cdpManagerAddress;
    ICDPManager public cdpManager;

    IPriceFeed public priceFeed;
    address public priceFeedAddress;

    ICLVToken public CLV;
    address public clvAddress;

    IStabilityPool public stabilityPool;
    address public stabilityPoolAddress;

    IPool public activePool;
    address public activePoolAddress;

    IPool public defaultPool;
    address public defaultPoolAddress;

    ICommunityIssuance public communityIssuance;
    address public communityIssuanceAddress;
   
   // --- Data structures ---
   
    mapping (address => uint) public initialDeposits;

    struct FrontEnd {
        uint kickbackRate;
        bool active;
    }

    struct Snapshots { 
        uint P; 
        uint S; 
        uint G; 
        uint128 scale;
        uint128 epoch;
    }

    mapping (address => FrontEnd) public frontEnds;
    mapping (address => uint) public totalTaggedDeposits;

    
    mapping (address => Snapshots) public frontEndSnapshots;

    /* Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit, 
    given a series of liquidations, each of which cancel some CLV debt with the deposit. 

    During its lifetime, a deposit's value evolves from d(0) to (d(0) * P / P(0) ), where P(0) 
    is the snapshot of P taken at the instant the deposit was made. 18 DP decimal.  */
    uint public P = 1e18;

     // Each time the scale of P shifts by 1e18, the scale is incremented by 1
    uint128 public currentScale; 

    // With each offset that fully empties the Pool, the epoch is incremented by 1
    uint128 public currentEpoch;  

    /* ETH Gain sum 'S': During it's lifetime, each deposit d(0) earns an ETH gain of ( d(0) * [S - S(0)] )/P(0), where S(0) 
    is the snapshot of S taken at the instant the deposit was made.
   
    The 'S' sums are stored in a nested mapping (epoch => scale => sum):

    - The inner mapping records the sum S at different scales
    - The outer mapping records the (scale => sum) mappings, for different epochs. */
    mapping (uint => mapping(uint => uint)) public epochToScaleToSum;
    mapping (uint => mapping(uint => uint)) public epochToScaleToG;

    // Map depositors to their individual snapshot structs
    mapping (address => Snapshots) public depositSnapshots;

    // Error trackers for the error correction in the offset calculation
    uint public lastETHError_Offset;
    uint public lastCLVLossError_Offset;

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    
    event DepositSnapshotUpdated(uint _P, uint _S);
    event P_Updated(uint _P);
    event S_Updated(uint _S);
    event DepositChanged(address indexed _user, uint _amount);
    event ETHGainWithdrawn(address indexed _user, uint _ETH, uint _CLVLoss);

    // --- Dependency setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _priceFeedAddress,
        address _CLVAddress,
        address _stabilityPoolAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _communityIssuanceAddress
    )
        external
        onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(_priceFeedAddress);
        clvAddress = _CLVAddress;
        CLV = ICLVToken(_CLVAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        stabilityPool = IStabilityPool(stabilityPoolAddress);
        activePoolAddress = _activePoolAddress;
        activePool = IPool(activePoolAddress);
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(defaultPoolAddress);
        communityIssuanceAddress = _communityIssuanceAddress;
        communityIssuance = ICommunityIssuance(_communityIssuanceAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit CLVTokenAddressChanged(_CLVAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    // Return the current ETH balance of the PoolManager contract
    function getBalance() external view returns (uint) {
        return address(this).balance;
    } 
    
    // Return the total active debt (in CLV) in the system
    function getActiveDebt() external view returns (uint) {
        return activePool.getCLVDebt();
    }    
    
    // Return the total active collateral (in ETH) in the system
    function getActiveColl() external view returns (uint) {
        return activePool.getETH();
    } 
    
    // Return the amount of closed debt (in CLV)
    function getClosedDebt() external view returns (uint) {
        return defaultPool.getCLVDebt();
    }    
    
    // Return the amount of closed collateral (in ETH)
    function getLiquidatedColl() external view returns (uint) {
        return defaultPool.getETH();
    }
    
    // Return the total CLV in the Stability Pool
    function getStabilityPoolCLV() external view returns (uint) {
        return stabilityPool.getCLV();
    }
    
    // --- Pool interaction functions ---

    // Add the received ETH to the total active collateral
    function addColl() external payable {
        _requireCallerIsBorrowerOperations();
    
        (bool success, ) = activePoolAddress.call.value(msg.value)("");
        assert(success == true);
    }
    
    // Transfer the specified amount of ETH to _account and updates the total active collateral
    function withdrawColl(address _account, uint _ETH) external {
        _requireCallerIsBorrowerOperations();
        activePool.sendETH(_account, _ETH);
    }
    
    // Issue the specified amount of CLV (minus the fee) to _account, and increase the total active debt
    function withdrawCLV(address _account, uint _CLVAmount, uint _CLVFee) external {
        _requireCallerIsBorrowerOperations();

        uint totalCLVDrawn = _CLVAmount.add(_CLVFee);
        activePool.increaseCLVDebt(totalCLVDrawn);  

        CLV.mint(_account, _CLVAmount);  
    }
    
    // Burn the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV) external {
        _requireCallerIsBorrowerOperations();
        activePool.decreaseCLVDebt(_CLV);
        CLV.burn(_account, _CLV);
    }           
    
    // Update the Active Pool and the Default Pool when a CDP gets closed
    function liquidate(uint _CLV, uint _ETH) external {
        _requireCallerIsCDPManager();

        defaultPool.increaseCLVDebt(_CLV);
        activePool.decreaseCLVDebt(_CLV);
        activePool.sendETH(defaultPoolAddress, _ETH);
    }

    // Move a CDP's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function movePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) external {
        _requireCallerIsCDPManager();

        defaultPool.decreaseCLVDebt(_CLV);  
        activePool.increaseCLVDebt(_CLV); 
        defaultPool.sendETH(activePoolAddress, _ETH); 
    }

    // Burn the received CLV, transfer the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(address _account, uint _CLV, uint _ETH) external {
        _requireCallerIsCDPManager();
       
        CLV.burn(_account, _CLV); 
        activePool.decreaseCLVDebt(_CLV);  
        activePool.sendETH(_account, _ETH); 
    }

    // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
    function _sendCLVtoStabilityPool(address _address, uint _amount) internal {
        CLV.sendToPool(_address, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
    }

    // --- Reward calculator functions for depositor and front end ---

    function getDepositorETHGain(address _depositor) external view returns (uint) {
        return _getDepositorETHGain(_depositor);
    }

    /* Return the ETH gain earned by the deposit. Given by the formula:  E = d0 * (S - S(0))/P(0)
    where S(0) and P(0) are the depositor's snapshots of the sum S and product P, respectively. */
    function _getDepositorETHGain(address _depositor) internal view returns (uint) {
        uint initialDeposit = initialDeposits[_depositor];

        if (initialDeposit == 0) { return 0; }

        uint snapshots = depositSnapshots[_depositor];

        uint ETHGain = _getETHGainFromSnapshots(initialDeposit, snapshots);
    }

    function _getETHGainFromSnapshots(uint initialDeposit, Snapshots memory snapshots) internal view returns (uint) {
         /* Grab the reward sum from the epoch at which the stake was made. The reward may span up to 
        one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */
        uint firstPortion = epochToScaleToSum[snapshots.epoch][snapshots.scale].sub(snapshots.S);
        uint secondPortion = epochToScaleToSum[snapshots.epoch][snapshots.scale.add(1)].div(1e18);

        uint ETHGain = initialDeposit.mul(firstPortion.add(secondPortion)).div(snapshots.P).div(1e18);
        
        return ETHGain;
    }

    function getDepositorLQTYGain(address _depositor) external view returns (uint) {
        return _getDepositorLQTYGain(_depositor);
    }

    /* Return the LQTY gain earned by the deposit. Given by the formula:  E = d0 * (G - G(0))/P(0)
    where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively. 
    
    d0 is the last recorded deposit value. */
    function _getDepositorLQTYGain(address _depositor) internal view returns (uint) {
        uint initialDeposit = initialDeposits[_depositor];
        if (initialDeposit == 0) { return 0; }

        uint snapshots = depositSnapshots[_depositor];  
      
        uint LQTYGain = _getLQTYGainFromSnapshots(initialDeposit, snapshots);
        return LQTYGain;
    }

    /* Return the LQTY gain earned by the front end. Given by the formula:  E = D0 * (G - G(0))/P(0)
    where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively.

    D0 is the last recorded value of the front end's total tagged deposits. */
    function _getFrontEndLQTYGain(address _frontEnd) internal view returns (uint) {
        uint frontEndStake = totalTaggedDeposits[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        uint snapshots = frontEndSnapshots[_frontEnd];  
      
        uint LQTYGain = _getLQTYGainFromSnapshots(frontEndStake, snapshots);
        return LQTYGain;
    }

    function _getLQTYGainFromSnapshots(uint initialStake, Snapshots memory snapshots) internal view returns (uint) {
         /* Grab the reward sum from the epoch at which the stake was made. The reward may span up to 
        one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */
        uint firstPortion = epochToScaleToG[snapshots.epoch][snapshots.scale].sub(snapshots.G);
        uint secondPortion = epochToScaleToG[snapshots.epoch][snapshots.scale.add(1)].div(1e18);

        uint LQTYGain = initialStake.mul(firstPortion.add(secondPortion)).div(snapshots.P).div(1e18);
        
        return LQTYGain;
    }

    // --- Compounded deposit and compounded front end stake ---

    function getCompoundedCLVDeposit(address _depositor) external view returns (uint) {
        return _getCompoundedCLVDeposit(_depositor);
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function _getCompoundedCLVDeposit(address _depositor) internal view returns (uint) {
        uint initialDeposit = initialDeposits[_depositor];
        if (initialDeposit == 0) { return 0; }

        uint snapshots = depositSnapshots[_depositor]; 
       
        uint compoundedDeposit = _getCompoundedStakeFromSnapshots(initialDeposit, snapshots);
        return compoundedDeposit;
    }

     function getCompoundedFrontEndStake(address _frontEnd) external view returns (uint) {
        return _getCompoundedFrontEndStake(_frontEnd);
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function _getCompoundedFrontEndStake(address _frontEnd) internal view returns (uint) {
        uint frontEndStake = totalTaggedDeposits[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        uint snapshots = frontEndSnapshots[_frontEnd]; 
       
        uint compoundedFrontEndStake = _getCompoundedStakeFromSnapshots(frontEndStake, snapshots);
        return compoundedFrontEndStake;
    }

    function _getCompoundedStakeFromSnapshots(uint initialStake, Snapshots memory snapshots) internal view {
        // If stake was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (snapshots.epoch < currentEpoch) {return 0;}

        uint compoundedStake;
        uint128 scaleDiff = currentScale.sub(snapshots.scale);
    
        /* Compute the compounded stake. If a scale change in P was made during the stake's lifetime, 
        account for it. If more than one scale change was made, then the stake has decreased by a factor of 
        at least 1e-18 -- so return 0.*/
        if (scaleDiff == 0) { 
            compoundedStake = initialStake.mul(P).div(snapshots.P);
        } else if (scaleDiff == 1) {
            compoundedStake = initialStake.mul(P).div(snapshots.P).div(1e18);
        } else {
            compoundedStake = 0;
        }

        // If compounded stake is less than a billionth of the initial deposit, return 0
        if (compoundedStake < initialStake.div(1e9)) {return 0;}

        return compoundedStake;
    }

    // --- Sender functions for CLV deposits and ETH gains ---

    function _sendETHGainToDepositor(address _depositor, uint ETHGain) internal {
        stabilityPool.sendETH(_depositor, ETHGain);
    }
    
    // Send ETHGain to depositor's CDP. Send in two steps: StabilityPool -> PoolManager -> depositor's CDP
    function _sendETHGainToCDP(address _depositor, uint _ETHGain, address _hint) internal {
        stabilityPool.sendETH(address(this), _ETHGain); 
        borrowerOperations.addColl.value(_ETHGain)(_depositor, _hint); 
    }

    // Send CLV to user and decrease CLV in Pool
    function _sendCLVToDepositor(address _depositor, uint CLVWithdrawal) internal {
        uint CLVinPool = stabilityPool.getCLV();
        assert(CLVWithdrawal <= CLVinPool);

        CLV.returnFromPool(stabilityPoolAddress, _depositor, CLVWithdrawal); 
        stabilityPool.decreaseCLV(CLVWithdrawal);
    }

    // --- Front end functionality ---

    function registerFrontEnd(uint _kickbackRate) external {
        _requireFrontEndNotRegistered(msg.sender);
        _requireValidKickbackRate(_kickbackRate);

        frontEnds[msg.sender].kickbackRate = _kickbackRate;
        frontEnds[msg.sender].active = true;
    }

    function withdrawFrontEndLQTYGain() external {
        _requireFrontEndIsRegistered(msg.sender);
        
        // Get LQTY gain
        uint LQTYGain = _getFrontEndLQTYGain(msg.sender);

        // Update front end's compounded stake
        uint compoundedFrontEndStake = _getCompoundedFrontEndStake(msg.sender);
        totalTaggedDeposits[msg.sender] = compoundedFrontEndStake;

        // Update front end's snapshots
        frontEndSnapshots[msg.sender].P = P;
        frontEndSnapshots[msg.sender].G = epochToScaleToG[currentEpoch][currentScale];
        frontEndSnapshots[msg.sender].scale = currentScale;
        frontEndSnapshots[msg.sender].epoch = currentEpoch;

        // send LQTY to the front end
        communityIssuance.sendLQTY(msg.sender, LQTYGain);
    }

    // --- Stability Pool Deposit Functionality --- 

    // Record a new deposit
    function _updateDeposit(address _depositor, uint _amount) internal {
        if (_amount == 0) {
            initialDeposits[_depositor] = 0;
            emit DepositSnapshotUpdated(depositSnapshots[_depositor].P, depositSnapshots[_depositor].S);
            return;
        }

        initialDeposits[_depositor] = _amount;
    
        // Record new individual snapshots of the running product P and sum S for the user
        depositSnapshots[_depositor].P = P;
        depositSnapshots[_depositor].S = epochToScaleToSum[currentEpoch][currentScale];
        depositSnapshots[_depositor].scale = currentScale;
        depositSnapshots[_depositor].epoch = currentEpoch;

        emit DepositSnapshotUpdated(depositSnapshots[_depositor].P, depositSnapshots[_depositor].S);
    }
 
    // --- External StabilityPool Functions ---

    /* Send ETHGain to user's address, and updates their deposit, 
    setting newDeposit = compounded deposit + amount. */
    function provideToSP(uint _amount) external {
        address user = _msgSender();
        uint initialDeposit = initialDeposits[user];

        if (initialDeposit == 0) {
            _sendCLVtoStabilityPool(user, _amount);
            _updateDeposit(user, _amount);
        
            emit DepositChanged(user, _amount);

        } else { // If user already has a deposit, make a new composite deposit and retrieve their ETH gain
            uint compoundedCLVDeposit = _getCompoundedCLVDeposit(user);
            uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit);
            uint ETHGain = _getDepositorETHGain(user);

            uint newDeposit = compoundedCLVDeposit.add(_amount);

            _sendCLVtoStabilityPool(user, _amount);
            _updateDeposit(user, newDeposit);

            _sendETHGainToDepositor(user, ETHGain);
            
            emit ETHGainWithdrawn(user, ETHGain, CLVLoss);
            emit DepositChanged(user, newDeposit); 
        }
    }

    /* Withdraw _amount of CLV and the caller’s entire ETH gain from the 
    Stability Pool, and updates the caller’s reduced deposit. 

    If  _amount is 0, the user only withdraws their ETH gain, no CLV.
    If _amount > userDeposit, the user withdraws all their ETH gain, and all of their compounded deposit.

    In all cases, the entire ETH gain is sent to user. */
    function withdrawFromSP(uint _amount) external {
        address user = _msgSender();
        _requireUserHasDeposit(user); 

        uint initialDeposit = initialDeposits[user];
        uint compoundedCLVDeposit = _getCompoundedCLVDeposit(user);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit);
        uint ETHGain = _getDepositorETHGain(user);

        uint CLVtoWithdraw = Math._min(_amount, compoundedCLVDeposit);
        uint CLVremainder = compoundedCLVDeposit.sub(CLVtoWithdraw);

        _sendCLVToDepositor(user, CLVtoWithdraw);
        _updateDeposit(user, CLVremainder);
      
        _sendETHGainToDepositor(user, ETHGain);

        emit ETHGainWithdrawn(user, ETHGain, CLVLoss);
        emit UserDepositChanged(user, CLVremainder); 
    }

    /* Transfer the caller's entire ETH gain from the Stability Pool to the caller's CDP, and leaves
    their compounded deposit in the Stability Pool.
    
    TODO: Remove _user param and just use _msgSender(). */
    function withdrawFromSPtoCDP(address _user, address _hint) external {
        require(_user == _msgSender(), "PoolManager: A user may only withdraw ETH gains to their own trove" );
        _requireUserHasDeposit(_user); 
        _requireUserHasTrove(_user);

        uint initialDeposit = initialDeposits[_user];
        uint compoundedCLVDeposit = _getCompoundedCLVDeposit(_user);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit);
        uint ETHGain = _getDepositorETHGain(_user);
       
        // Update the recorded deposit value, and deposit snapshots
        _updateDeposit(_user, compoundedCLVDeposit);

        /* Emit events before transferring ETH gain to CDP.
         This lets the event log make more sense (i.e. so it appears that first the ETH gain is withdrawn 
        and then it is deposited into the CDP, not the other way around). */
        emit ETHGainWithdrawn(_user, ETHGain, CLVLoss);
        emit UserDepositChanged(_user, compoundedCLVDeposit); 

        _sendETHGainToCDP(_user, ETHGain, _hint);
    }

     /* Cancel out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    and transfers the CDP's ETH collateral from ActivePool to StabilityPool. 
    Only called from liquidation functions in CDPManager. */
    function offset(uint _debtToOffset, uint _collToAdd) 
    external 
    payable 
     
    {    
        _requireCallerIsCDPManager();
        uint totalCLVDeposits = stabilityPool.getCLV(); 
        if (totalCLVDeposits == 0 || _debtToOffset == 0) { return; }
        
        (uint ETHGainPerUnitStaked,
         uint CLVLossPerUnitStaked) = _computeRewardsPerUnitStaked(_collToAdd, _debtToOffset, totalCLVDeposits);

        _updateRewardSumAndProduct(ETHGainPerUnitStaked, CLVLossPerUnitStaked);

        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    // --- Offset helper functions ---

    function _computeRewardsPerUnitStaked(uint _collToAdd, uint _debtToOffset, uint _totalCLVDeposits) 
    internal 
    returns (uint ETHGainPerUnitStaked, uint CLVLossPerUnitStaked) 
    {
        uint CLVLossNumerator = _debtToOffset.mul(1e18).sub(lastCLVLossError_Offset);
        uint ETHNumerator = _collToAdd.mul(1e18).add(lastETHError_Offset);

        // Compute the CLV and ETH rewards, and error corrections
        if (_debtToOffset >= _totalCLVDeposits) {
            CLVLossPerUnitStaked = 1e18;
            lastCLVLossError_Offset = 0;
        } else {
            CLVLossPerUnitStaked = (CLVLossNumerator.div(_totalCLVDeposits)).add(1); // add 1 to make error in quotient positive
             lastCLVLossError_Offset = (CLVLossPerUnitStaked.mul(_totalCLVDeposits)).sub(CLVLossNumerator);
        } 

        ETHGainPerUnitStaked = ETHNumerator.div(_totalCLVDeposits); 
        lastETHError_Offset = ETHNumerator.sub(ETHGainPerUnitStaked.mul(_totalCLVDeposits)); 

        return (ETHGainPerUnitStaked, CLVLossPerUnitStaked);
    }

    // Update the Stability Pool reward sum S and product P
    function _updateRewardSumAndProduct(uint _ETHGainPerUnitStaked, uint _CLVLossPerUnitStaked) internal {
         // Make product factor 0 if there was a pool-emptying. Otherwise, it is (1 - CLVLossPerUnitStaked)
        uint newProductFactor = _CLVLossPerUnitStaked >= 1e18 ? 0 : uint(1e18).sub(_CLVLossPerUnitStaked);
     
        // Update the ETH reward sum at the current scale and current epoch
        uint marginalETHGain = _ETHGainPerUnitStaked.mul(P);
        epochToScaleToSum[currentEpoch][currentScale] = epochToScaleToSum[currentEpoch][currentScale].add(marginalETHGain);
        emit S_Updated(epochToScaleToSum[currentEpoch][currentScale]); 

       // If the Pool was emptied, increment the epoch and reset the scale and product P
        if (newProductFactor == 0) {
            currentEpoch = currentEpoch.add(1);
            currentScale = 0;
            P = 1e18;
    
        // If multiplying P by a non-zero product factor would round P to zero, increment the scale 
        } else if (P.mul(newProductFactor) < 1e18) {
            P = P.mul(newProductFactor);
            currentScale = currentScale.add(1);
         } else {
            P = P.mul(newProductFactor).div(1e18); 
        }

        emit P_Updated(P); 
    }

    function _moveOffsetCollAndDebt(uint _collToAdd, uint _debtToOffset) internal {
        // Cancel the liquidated CLV debt with the CLV in the stability pool
        activePool.decreaseCLVDebt(_debtToOffset);  
        stabilityPool.decreaseCLV(_debtToOffset); 
       
        // Send ETH from Active Pool to Stability Pool
        activePool.sendETH(stabilityPoolAddress, _collToAdd);  

        // Burn the debt that was successfully offset
        CLV.burn(stabilityPoolAddress, _debtToOffset); 
    }

    // --- 'require' wrapper functions ---

    function _onlyStabilityPoolorActivePool() internal view {
        require(
            _msgSender() == stabilityPoolAddress ||  _msgSender() ==  activePoolAddress, 
            "PoolManager: Caller is neither StabilityPool nor ActivePool");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(_msgSender() == borrowerOperationsAddress, "PoolManager: Caller is not the BorrowerOperations contract");
    }

    function _requireCallerIsCDPManager() internal view {
        require(_msgSender() == cdpManagerAddress, "PoolManager: Caller is not the CDPManager");
    }

    function _requireUserHasDeposit(address _address) internal view {
        uint initialDeposit = initialDeposits[_address];  
        require(initialDeposit > 0, 'PoolManager: User must have a non-zero deposit');  
    }

    function _requireUserHasTrove(address _user) internal view {
        require(cdpManager.getCDPStatus(_user) == 1, "CDPManager: caller must have an active trove to withdraw ETHGain to");
    }

    function _requireFrontEndNotRegistered(address _address) internal view {
        require(frontEnds[_address].active == false, "CommunityIssuance: must not already be an active front end");
    }

    function _requireFrontEndIsRegistered(address _address) internal view {
        require(frontEnds[_address].active == true, "CommunityIssuance: must be an active front end");
    }

    function  _requireValidKickbackRate(uint _kickbackRate) internal pure {
        require (_kickbackRate >= 0 && _kickbackRate <= 1e18, "CommunityIssuance: Kickback rate must be in range [0,1]");
    }

    // --- Fallback function ---
    
    function() external payable {
        _onlyStabilityPoolorActivePool();
    }
}    