<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [PopulatableEthersLiquity](./lib-ethers.populatableethersliquity.md) &gt; [pngApproveUniTokens](./lib-ethers.populatableethersliquity.pngapproveunitokens.md)

## PopulatableEthersLiquity.pngApproveUniTokens() method

Allow the liquidity mining contract to use Png Pool2 LP tokens for [staking](./lib-base.transactableliquity.pngstakeunitokens.md)<!-- -->.

<b>Signature:</b>

```typescript
pngApproveUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  allowance | [Decimalish](./lib-base.decimalish.md) | Maximum amount of LP tokens that will be transferrable to liquidity mining (<code>2^256 - 1</code> by default). |
|  overrides | [EthersTransactionOverrides](./lib-ethers.etherstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[PopulatedEthersLiquityTransaction](./lib-ethers.populatedethersliquitytransaction.md)<!-- -->&lt;void&gt;&gt;

## Remarks

Must be performed before calling [pngStakeUniTokens()](./lib-base.transactableliquity.pngstakeunitokens.md)<!-- -->.

