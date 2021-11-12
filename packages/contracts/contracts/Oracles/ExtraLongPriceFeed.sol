// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IUniswapOracle.sol";

import "openzeppelin-solidity/contracts/access/Ownable.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IERC20.sol';

/**
 * @title Top-level price oracle for Extra Long
 * @author Extra Long
 * @notice This oracle uses an external sub-oracle, UniswapOracle, to get price of ONE.
 */

contract ExtraLongPriceFeed is Ownable, IPriceFeed {

  address public woneUsdOracleAddress;
  address public woneTokenAddress;
  
  function setWoneUsdOracleAddress(address _address) external OnlyOwner {
    require(_address != address(0), "Invalid oracle address.");

    wonUsdOracleAddress = _address;
  }

  function setWoneTokenAddress(address _address) external OnlyOwner {
    require(_address != address(0), "Invalid WONE token address.");

    woneTokenAddress = _address;
  }

  function fetchPrice() external override returns (uint) {
    require(address(woneUsdOracleAddress) != address(0), "UniswapOracle::WONE oracle not set");
    require(address(woneTokenAddress) != address(0), "WONE token not set");

    return IUniswapOracle(woneUsdOracleAddress).getPrice(woneTokenAddress);
  }

  function setAddresses(
        address _woneUsdOracleAddress,
        address _woneTokenAddress;
    )
        external
        onlyOwner
    {
        checkContract(_woneUsdOracleAddress);
        checkContract(_woneTokenAddress);

        woneUsdOracleAddress = _woneUsdOracleAddress;
        woneTokenAddress = _woneTokenAddress;

        _renounceOwnership();
    }
}