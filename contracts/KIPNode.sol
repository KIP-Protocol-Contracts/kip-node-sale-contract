// SPDX-License-Identifier: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract KIPNode is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PublicSale {
        uint256 price;
        uint32 maxPerTier;
        uint32 maxPerUser;
        uint256 totalMintedAmount;
        uint64 start;
        uint64 end;
    }

    struct WhitelistSale {
        bytes32 merkleRoot;
        uint32 maxPerTier;
        uint256 totalMintedAmount;
        uint64 start;
        uint64 end;
    }

    //  Store address of ERC-20 token as payment acceptance
    IERC20 public paymentToken;

    //  TokenId counter
    uint256 private _nextTokenId;

    // KIP Protocol 's Fund Address
    address public KIPFundAddress = 0x6E3bbb13330102989Ac110163e4C649d0bB88777;

    // Set max number of tiers for the sale event
    uint256 constant public MAX_TIER = 38;

    //  Mappings to store Sale Configurations (Public Sale and Whitelist Sale)
    mapping(uint256 => PublicSale) public publicSaleConfigs;
    mapping(uint256 => WhitelistSale) public whitelistSaleConfigs;

    //  Mappings to record total minted Licenses per `buyer` (by tier)
    mapping(uint256 => mapping(address => uint256)) public whitelistUserMinted;
    mapping(uint256 => mapping(address => uint256)) public publicUserMinted;

    //  Mapping to store a list of authorized Operators
    mapping(address => bool) public kipOperator;

    //  A boolean flag to allow/block transferring License NFTs
    bool public transferEnabled;

    //  Store Base URI of the License NFT contract
    string public baseURI;

    event OperatorChanged(address operator, bool enabled);
    event TokenMinted(
        address indexed operator,
        address indexed to,
        uint256 tier,
        uint256 tokenId,
        uint256 price,
        bool whitelist,
        string code
    );

    event MintCountUpdated(
        address indexed operator,
        uint256 tier,
        bool whitelist,
        uint256 user_mint_count,
        uint256 tier_mint_count
    );

    modifier onlyOperator() {
        require(kipOperator[_msgSender()], "Unauthorized");
        _;
    }

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
    ) external nonReentrant {
        //  Validate passing parameters
        require(
            tier != 0 && tier <= MAX_TIER && amount != 0 && to != address(0),
            "Invalid params"
        );

        //  Validate request's timestamp and the requesting amount
        PublicSale memory config = publicSaleConfigs[tier];
        address sender = _msgSender();
        require(
            config.start <= block.timestamp && block.timestamp <= config.end,
            "Sale: Not yet started or ended"
        );
        require(config.price != 0, "Price is set zero");
        require(
            publicUserMinted[tier][sender] + amount <= config.maxPerUser &&
                config.totalMintedAmount + amount <= config.maxPerTier,
            "Exceed allowance"
        );

        //  Update state storage to avoid re-entrancy attack
        publicSaleConfigs[tier].totalMintedAmount += amount; //  overflow is guaranteed by checking above
        publicUserMinted[tier][sender] += amount;
        emit MintCountUpdated(
            sender,
            tier,
            false,
            publicUserMinted[tier][sender],
            publicSaleConfigs[tier].totalMintedAmount
        );

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
    */
    function whitelistMint(
        uint256 tier,
        address to,
        uint256 amount,
        uint256 maxAmount,
        bytes32[] calldata merkleProof
    ) external nonReentrant{
        //  Validate passing parameters
        require(
            tier != 0 && tier <= MAX_TIER && to != address(0) && amount != 0,
            "Invalid params"
        );

        //  Validate request's timestamp and the requesting amount
        //  also validate proof to check its authentication
        WhitelistSale memory config = whitelistSaleConfigs[tier];
        address sender = _msgSender();
        require(
            config.start <= block.timestamp && block.timestamp <= config.end,
            "Sale: Not yet started or ended"
        );
        require(
            whitelistUserMinted[tier][sender] + amount <= maxAmount &&
                config.totalMintedAmount + amount <= config.maxPerTier,
            "Exceed allowance"
        );
        require(
            validateProof(tier, to, maxAmount, merkleProof),
            "Invalid proof"
        );

        //  Update state storage to avoid re-entrancy attack
        //  overflow is guaranteed by checking above
        whitelistUserMinted[tier][sender] += amount;
        whitelistSaleConfigs[tier].totalMintedAmount += amount;
        emit MintCountUpdated(
            sender,
            tier,
            true,
            whitelistUserMinted[tier][sender],
            whitelistSaleConfigs[tier].totalMintedAmount
        );

        //  And finally mint the License NFts
        for (uint256 i = 1; i <= amount; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
            emit TokenMinted(sender, to, tier, _nextTokenId, 0, true, "");
        }
    }

    /** 
        @notice Update the new value of `baseURI`
        @dev
        - Requirements:
          - Caller must be `owner`
        - Params:
          - newURI      A new value of `baseURI` (as string)
    */
    function setBaseURI(string calldata newURI) external onlyOwner {
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
        PublicSale calldata settings
    ) external onlyOperator {
        publicSaleConfigs[tier] = settings;
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
    */
    function setWhitelistSaleConfigs(
        uint256 tier,
        WhitelistSale calldata settings
    ) external onlyOperator {
        whitelistSaleConfigs[tier] = settings;
    }

    /** 
        @notice Allow/Disable License Transfer
        @dev
        - Requirements:
          - Caller must have Operator role
        - Params:
          - newState            New state of `transferEnabled` (true or false)
    */
    function setTransferEnabled(bool newState) external onlyOperator {
        transferEnabled = newState;
    }

    /** @notice Update the new address of KIP Protocol Treasury
        @dev
        - Requirements:
          - Caller must be `owner`
        - Params:
          - newAddress            New address of KIP Protocol Treasury
    */
    function setKIPFundAddress(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Set 0x00");
        KIPFundAddress = newAddress;
    }

    /** @notice Set new Payment Token
        @dev
        - Requirements:
          - Caller must be `owner`
        - Params:
          - token            New address of the payment acceptance (ERC-20)
    */
    function setPaymentToken(address token) external onlyOwner {
        require(token != address(0), "Set 0x00");
        paymentToken = IERC20(token);
    }

    /** @notice Update authorized Operators
        @dev
        - Requirements:
          - Caller must be `owner`
        - Params:
          - operator            Address of the Operator
          - enabled             Enable or Disable (true or false)
    */
    function setKipOperator(address operator, bool enabled) external onlyOwner {
        kipOperator[operator] = enabled;
        emit OperatorChanged(operator, enabled);
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
    function validateProof(
        uint256 tier,
        address to,
        uint256 maxAmount,
        bytes32[] calldata merkleProof
    ) public view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(to, maxAmount));
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
