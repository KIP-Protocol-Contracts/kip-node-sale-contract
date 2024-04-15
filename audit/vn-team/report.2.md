# Reports for review https://github.com/KIP-Protocol-Contracts/kip-node-sale-contract/commit/a8be2ddaec9445b9ed175a1fbcc5e5c9aef85a0a

Could we verify the roles of operator vs owner in KIP Node?
- who allow sale (public/private) to begin?
- who allow to set tier config?
- where documented the owner as origin, then saw some changes switch to operator!

Currently, what struct data you hash the merkle left offchain  to verify the whitelist onchain?
If not use correctly, contract can't verify whitelist

Why not using block.timestamp in indexer, but write directly in contract block.timestamp?
```solidity
emit MintCountUpdated(
    sender,
    tier,
    false,
    publicSaleConfigs[tier].totalMintedAmount,
    false, block.timestamp
);
```

Why the code still not follow the convention?
```solidity
    event TokenMinted(
        address indexed operator,
        address indexed to,
        uint256 tier,
        uint256 tokenId,
        uint256 price,
        bool whitelist,
        string code,
        uint256 block_timestamp
    );

    event MintCountUpdated(
        address indexed operator,
        uint256 tier,
        bool whitelist,
        uint256 mint_count,
        bool is_user,
        uint256 block_timestamp
    );
```
How you know which event to track as the event hash is the same?

```solidity
    //  Update state storage to avoid re-entrancy attack
    publicSaleConfigs[tier].totalMintedAmount += amount; //  overflow is guaranteed by checking above
    emit MintCountUpdated(
        sender,
        tier,
        false,
        publicSaleConfigs[tier].totalMintedAmount,
        false, block.timestamp
    );

    publicUserMinted[tier][sender] += amount;
    emit MintCountUpdated(
        sender,
        tier,
        false,
        publicUserMinted[tier][sender],
        true, block.timestamp
    );
```

- What the mint limit 50,000? But I can find anywhere?