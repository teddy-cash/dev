// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IUniswapOracle {

    // --- Events ---
    event PairOracleSet(address token, UniswapPairTwapOracle pairOracle);
    event OneUsdOracleSet(UniswapPairTwapOracle woneUsdOracle, uint8 usdTokenDecimals);
   
    // --- Function ---
    function setWoneUsdOracle(UniswapPairTwapOracle _woneUsdOracle) external;
    function addPairOracle(address _token, UniswapPairTwapOracle _pairOracle) external;
    function hasReliablePrice(address _token) external view returns (bool);
    function hasSufficientLiquidity(IUniswapV2Pair pair) internal view returns (bool);
    function getPrice(address _token) external view returns (uint);
}
