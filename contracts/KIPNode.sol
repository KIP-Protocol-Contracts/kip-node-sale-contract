// SPDX-License-Identifier: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

error InvalidRequest();
error SaleEventNotExist(uint256 start, uint256 end);
error PriceNotConfigured();
//  error setPriceZero();
error ExceedAllowance();
error InvalidProof();
error InvalidURI();
error SetAddressZero();
error InvalidConfig(uint256 minTier, uint256 maxTier);

contract KIPNode is ERC721, Ownable {
    using SafeERC20 for IERC20;

    struct PublicSale {
        uint256 price;
        uint32 maxPerTier;
        uint32 maxPerUser;
        uint64 totalMintedAmount;
        uint64 start;
        uint64 end;
    }

    struct WhitelistSale {
        bytes32 merkleRoot;
        uint32 maxPerTier;
        uint64 totalMintedAmount;
        uint64 start;
        uint64 end;
    }

    //  Store address of ERC-20 token as payment acceptance
    IERC20 public paymentToken;

    //  TokenId counter
    uint256 private _nextTokenId;

    // KIP Protocol 's Fund Address
    address public KIPFundAddress = 0x420640795953C325F5092B633228A111774ee430;

    // Set max number of tiers for the sale event
    uint256 public constant MAX_TIER = 99;

    //  Mappings to store Sale Configurations (Public Sale and Whitelist Sale)
    mapping(uint256 => PublicSale) public publicSaleConfigs;
    mapping(uint256 => WhitelistSale) public whitelistSaleConfigs;

    //  Mappings to record total minted Licenses per `tier`
    mapping(uint256 => uint64) public whitelistTotalMinted;
    mapping(uint256 => uint64) public publicTotalMinted;

    //  Mappings to record total minted Licenses per `buyer` (by tier)
    mapping(uint256 => mapping(address => uint256)) public whitelistUserMinted;
    mapping(uint256 => mapping(address => uint256)) public publicUserMinted;

    //  A boolean flag to allow/block transferring License NFTs
    bool public transferEnabled;

    //  Store Base URI of the License NFT contract
    string public baseURI;

    event TransferEnabledUpdated(
        address indexed sender,
        bool status
    );

    event WhitelistSaleConfigUpdated(
        address indexed sender,
        uint256 tier,
        WhitelistSale config
    );

    event FundReceiverUpdated(
        address indexed sender,
        address receiver
    );

    event PublicSaleConfigUpdated(
        address indexed sender,
        uint256 tier,
        PublicSale config
    );

    event TokenMinted(
        address indexed sender,
        address indexed to,
        uint256 tier,
        uint256 tokenId,
        uint256 price,
        bool whitelist,
        string code
    );

    event MintCountUpdated(
        address indexed sender,
        uint256 tier,
        bool whitelist,
        uint256 userMintCount,
        uint256 tierMintCount
    );

    constructor(
        address initialOwner,
        address paymentToken_
    ) ERC721("KIP License", "KIPNODE") Ownable(initialOwner) {
        paymentToken = IERC20(paymentToken_);
        baseURI = "https://node-nft.kip.pro/";
    }

    /** 
        @notice Function for Minting Licenses in the Public Sale
        @dev
        - Requirements:
          - Caller can be ANY
        - Params:
          - tier      Tier number (1 ~ 38)
          - to        Address of the Receiver
          - amount    A number of Licenses is requested to mint
          - code      External message
    */
    function publicMint(
        uint256 tier,
        address to,
        uint256 amount,
        string calldata code
    ) external {
        //  Validate passing parameters
        if (tier == 0 || tier > MAX_TIER || amount == 0 || to == address(0))
            revert InvalidRequest();

        //  Validate request's timestamp and the requesting amount
        PublicSale memory config = publicSaleConfigs[tier];
        address sender = _msgSender();
        if (block.timestamp < config.start || block.timestamp > config.end)
            revert SaleEventNotExist(config.start, config.end);
        if (config.price == 0) revert PriceNotConfigured();
        if (
            publicUserMinted[tier][sender] + amount > config.maxPerUser ||
            publicTotalMinted[tier] + amount > config.maxPerTier
        ) revert ExceedAllowance();

        //  Update state storage to avoid re-entrancy attack
        publicTotalMinted[tier] += uint64(amount); //  overflow is guaranteed by checking above
        publicUserMinted[tier][sender] += amount;

        //  Payment
        uint256 totalPayment = config.price * amount;
        paymentToken.safeTransferFrom(sender, KIPFundAddress, totalPayment);

        //  Finally, call to mint License NFTs
        for (uint256 i = 1; i <= amount; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
            emit TokenMinted(
                sender,
                to,
                tier,
                _nextTokenId,
                config.price,
                false,
                code
            );
        }

        emit MintCountUpdated(
            sender,
            tier,
            false,
            publicUserMinted[tier][sender],
            publicTotalMinted[tier]
        );
    }

    /** 
        @notice Function for Minting Licenses in the Whitelist Sale
        @dev
            - Requirements:
              - Caller can be ANY
            - Params:
              - tier            Tier number (1 ~ 38)
              - to              Address of the Receiver
              - amount          A number of Licenses is requested to mint
              - maxAmount       A max number of Licenses can be purchased (set in the Merkle Tree)
              - merkleProof     An array of proof
    */
    function whitelistMint(
        uint256 tier,
        address to,
        uint256 amount,
        uint256 maxAmount,
        bytes32[] calldata merkleProof
    ) external {
        //  Validate passing parameters
        if (tier == 0 || tier > MAX_TIER || to == address(0) || amount == 0)
            revert InvalidRequest();

        //  Validate request's timestamp and the requesting amount
        //  also validate proof to check its authentication
        WhitelistSale memory config = whitelistSaleConfigs[tier];
        address sender = _msgSender();
        if (block.timestamp < config.start || block.timestamp > config.end)
            revert SaleEventNotExist(config.start, config.end);
        if (
            whitelistUserMinted[tier][sender] + amount > maxAmount ||
            whitelistTotalMinted[tier] + amount > config.maxPerTier
        ) revert ExceedAllowance();
        if (!_validateProof(tier, sender, maxAmount, merkleProof))
            revert InvalidProof();

        //  Update state storage to avoid re-entrancy attack
        //  overflow is guaranteed by checking above
        whitelistUserMinted[tier][sender] += amount;
        whitelistTotalMinted[tier] += uint64(amount);

        //  And finally mint the License NFts
        for (uint256 i = 1; i <= amount; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
            emit TokenMinted(sender, to, tier, _nextTokenId, 0, true, "");
        }

        emit MintCountUpdated(
            sender,
            tier,
            true,
            whitelistUserMinted[tier][sender],
            whitelistTotalMinted[tier]
        );
    }

    /** 
        @notice Update the new value of `baseURI`
        @dev
        - Requirements:
          - Caller must be `owner`
          - New string value of `baseURI` should not be empty
        - Params:
          - newURI      A new value of `baseURI` (as string)
    */
    function setBaseURI(string calldata newURI) external onlyOwner {
        if (bytes(newURI).length == 0) revert InvalidURI();

        baseURI = newURI;
    }

    /** 
        @notice Update the Public Sale configurations (per Tier)
        @dev
        - Requirements:
          - Caller must be `owner`
        - Params:
          - tier            Tier number (1 ~ 38)
          - settings:
            - start               The starting time of the Public Sale (timestamp)
            - end                 The ending time of the Public Sale (timestamp)
            - price               The payment amount per License
            - totalMintedAmount   The total Licenses that minted in the event (init value = 0)
            - maxPerUser          The max number of Licenses is allowed to purchased
            - maxPerTier          The max number of Licenses can be purchased in this tier
    */
    function setPublicSaleConfigs(
        uint256 tier,
        PublicSale memory settings
    ) external onlyOwner {
        //  Note: Due to business logic, smart contract wouldn't validate the detail settings (i.e. start/end/price)
        //  In fact, the validation must be done by off-chain mechanism,
        //  and the smart contract allow `overwrite`
        if (tier == 0 || tier > MAX_TIER) revert InvalidConfig(1, MAX_TIER);
        //  if (settings.price == 0) revert setPriceZero();

        publicSaleConfigs[tier] = settings;

        emit PublicSaleConfigUpdated(
            _msgSender(),
            tier,
            settings
        );
    }

    /** 
        @notice Update the Whitelist Sale configurations (per Tier)
        @dev
        - Requirements:
          - Caller must be `owner`
        - Params:
          - tier            Tier number (1 ~ 38)
          - settings:
            - start               The starting time of the Whitelist Sale (timestamp)
            - end                 The ending time of the Whitelist Sale (timestamp)
            - totalMintedAmount   The total Licenses that minted in the event (init value = 0)
            - maxPerTier          The max number of Licenses can be purchased in this tier
            - merkleRoot          The computed hash of Merkle Tree
    */
    function setWhitelistSaleConfigs(
        uint256 tier,
        WhitelistSale memory settings
    ) external onlyOwner {
        //  Note: Due to business logic, smart contract wouldn't validate the detail settings (i.e. start/end/merkleRoot)
        //  In fact, the validation must be done by off-chain mechanism,
        //  and the smart contract allow `overwrite`
        if (tier == 0 || tier > MAX_TIER) revert InvalidConfig(1, MAX_TIER);

        whitelistSaleConfigs[tier] = settings;

        emit WhitelistSaleConfigUpdated(
            _msgSender(),
            tier,
            settings
        );
    }

    /** 
        @notice Allow/Disable License Transfer
        @dev
        - Requirements:
          - Caller must be `owner`
        - Params:
          - newState            New state of `transferEnabled` (true or false)
    */
    function setTransferEnabled(bool newState) external onlyOwner {
        transferEnabled = newState;

        emit TransferEnabledUpdated(
            _msgSender(),
            newState
        );
    }

    /** @notice Update the new address of KIP Protocol Treasury
        @dev
        - Requirements:
          - Caller must be `owner`
          - New updating address must be non-zero (not 0x00)
        - Params:
          - newAddress            New address of KIP Protocol Treasury
    */
    function setKIPFundAddress(address newAddress) external onlyOwner {
        if (newAddress == address(0)) revert SetAddressZero();

        KIPFundAddress = newAddress;

        emit FundReceiverUpdated(
            _msgSender(),
            newAddress
        );
    }

    /** @notice Set new Payment Token
        @dev
        - Requirements:
          - Caller must be `owner`
          - New updating payment token must be non-zero (not 0x00)
        - Params:
          - token            New address of the payment acceptance (ERC-20)
    */
    function setPaymentToken(address token) external onlyOwner {
        if (token == address(0)) revert SetAddressZero();

        paymentToken = IERC20(token);
    }

    /** Validate Merkle Proof before calling whitelistMint function
    - Merkle Root (hash) already set (per tier) before the Sale event
    - Requirements:
      - Caller can be ANY
    - Params:
      - tier            Tier number (1 ~ 38)
      - to              Address of the Receiver
      - maxAmount       A max number of Licenses can be purchased (set in the Merkle Tree)
      - merkleProof     An array of connecting nodes in the Merkle Tree
    - Return: `true` or `false` 
    */
    function _validateProof(
        uint256 tier,
        address to,
        uint256 maxAmount,
        bytes32[] calldata merkleProof
    ) public view returns (bool) {
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(to, maxAmount)))
        );
        return
            MerkleProof.verify(
                merkleProof,
                whitelistSaleConfigs[tier].merkleRoot,
                leaf
            );
    }

    /** Override the logic of ERC-721 implementation
    - During the locking state, `transferEnabled = false`, License NFTs are un-transferrable
    - Minting License is acceptable while burning is not allowed
    */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address previousOwner = super._update(to, tokenId, auth);
        require(
            transferEnabled || previousOwner == address(0),
            "Transfer not enabled"
        );
        return previousOwner;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
