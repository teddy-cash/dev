pragma solidity 0.5.16;

import './Interfaces/IPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract DefaultPool is Ownable, IPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    address public activePoolAddress;
    uint256 internal ETH;  // deposited ether tracker
    uint256 internal CLVDebt;  // total outstanding CDP debt

    // --- Modifiers ---

    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "DefaultPool:  Caller is not the PoolManager");
        _;
    }

    modifier onlyActivePool {
        require(_msgSender() == activePoolAddress, "DefaultPool: Caller is not ActivePool");
        _;
    }

    // --- Dependency setters ---

    function setAddresses(
        address _poolManagerAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
    {
        poolManagerAddress = _poolManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit PoolManagerAddressChanged(_poolManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() external view returns (uint) {
        return ETH;
    }

    function getCLVDebt() external view returns (uint) {
        return CLVDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external onlyPoolManager {
        ETH = ETH.sub(_amount); 
         emit EtherSent(_account, _amount);  

        (bool success, ) = _account.call.value(_amount)("");  // use call.value()('') as per Consensys latest advice 
        require(success, "DefaultPool: sending ETH failed");     
    }

    function increaseCLVDebt(uint _amount) external onlyPoolManager {
        CLVDebt = CLVDebt.add(_amount);
    }

    function decreaseCLVDebt(uint _amount) external onlyPoolManager {
        CLVDebt = CLVDebt.sub(_amount); 
    }

    /* Returns the raw ether balance at DefaultPool address.  
    Not necessarily equal to the ETH state variable - ether can be forcibly sent to contracts. */
    function getRawETHBalance() external view returns (uint) {
        return address(this).balance;
    }

    function () external payable onlyActivePool {
        ETH = ETH.add(msg.value);
    }
}
