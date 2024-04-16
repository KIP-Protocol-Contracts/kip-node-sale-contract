- How many KIP License will be issued (minted in tech term) 50,000? 
- Can this minted value be changed?
- In the table here https://docs.google.com/document/d/1IFbZMbZQZPp-4vW2yiIzUgzRJvX80RoNlDfZeU1jbw8/edit
There's a line `Total Token Supply Available for Nodes: Up to 20%` What does it means?
- Will number of tier/ number of license per tier/ max licence per address will be changed in the future?
- Will sale time window be updated interface future?
- Will NFT will automatically be transferrable after certain amount of time?
- Will baseURI be changed in the future?
- How many roles of KIP team be introduced onchain?
    Currently, we have owner and operator
- What kind of permissions owner and operator have?
    Currently, we have 
    - owner allow to set operator
    - owner allow to set paymentToken
    - owner allow to set setKIPFundAddress (receive the payment)
    - owner allow to set base URI like https://node-nft.kip.pro/
    - operator allow to set all sale transferable
    - operator allow to set whitelist sale info (tier, time window, total minted in the sale, max license per tier)
    - operator allow to set whitelist sale info (tier, time window, total minted in the sale, max license per tier, max license per tier per user)
    - operator allow to set all number in https://docs.google.com/document/d/1IFbZMbZQZPp-4vW2yiIzUgzRJvX80RoNlDfZeU1jbw8/edit
- Please confirm the whitelist flow as beflow
    Flow:
    - Set the whitelist by operator
      Onchain data:
      ```
        bytes32 merkleRoot;
        uint32 maxPerTier;
        uint256 totalMintedAmount;
        uint64 start;
        uint64 end;
      ```
    - Everytime an wallet address added into whitelist per tier, we have to compute merkle proof with following structure with exact order. After get all the , the proof
      ```json
        [
          {
            to: 'address' // address allowed to mint
            maxAmount: 'uint256' // max amount to mint in a tier
          }
        ]
      ```
    - So if we have 1000 of addresses in the whitelist, operator will compute 1000 times in the exact order, and we do it each tier. 
    - After 1000 addresses confirmed for an specified tier, the proof will be upload onchain to create proof
    - Operator can change this list later on
- What number affect the whitelist?
    - Address
    - Amount of License in a tier
- How many token will be set as payment set as payment token?
- Who will allow to set payment token (owner or operator)?
