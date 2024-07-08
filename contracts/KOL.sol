// SPDX-License-Identifier: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

error InvalidRequest();
error SaleEventNotExist(uint256 start, uint256 end);
error ExceedAllowance();
error InvalidProof();
error SetAddressZero();
error InvalidConfig(uint256 minTier, uint256 maxTier);

contract KOL is Ownable {
    using SafeERC20 for IERC20;

    // Struct to store Whitelist Sale configuration details
    struct KOL_Sale {
        bytes32 merkleRoot;
        uint256 minPrice;
        uint32 maxPerUser;
        uint64 start;
        uint64 end;
    }

    //  Address of the ERC-20 token used for payment
    IERC20 public paymentToken;

    //  Ticket counter
    uint256 public ticketCounter;

    // Address to receive funds
    address public fundAddress = 0x420640795953C325F5092B633228A111774ee430;

    // Maximum number of tiers for the sale event
    uint256 public constant MAX_TIER = 999;

    // Mapping to store Whitelist Sale configurations
    // mapping(uint256 => WhitelistSale) public whitelistSaleConfigs;

    // Mapping to store Whitelist Sale configurations
    mapping(bytes32 => KOL_Sale) public kolSaleConfigs;

    // Mapping to record total minted tickets per tier
    mapping(uint256 => uint256) public tierTotalSale;

    // Mapping to record total minted tickets per buyer per tier
    mapping(uint256 => mapping(address => uint256)) public tierBuyerMinted;

    // Mapping to record total minted tickets per code per tier
    mapping(bytes32 => mapping(uint256 => uint256)) public codeTierSale;
    mapping(bytes32 => uint256) public codeTotalSale;

    // Mapping to record buyer address per ticket ID per tier
    mapping(uint256 => mapping(uint256 => address)) public tierTicketBuyer;

    // Event emitted when the fund receiver address is updated
    event FundReceiverUpdated(address indexed sender, address receiver);

    // Event emitted when a Whitelist Sale configuration is updated
    // event WhitelistSaleConfigUpdated(address indexed sender, uint256 tier, WhitelistSale config);
    // Event emitted when a Whitelist Sale configuration is updated
    event kolSaleConfigUpdated(address indexed sender, bytes32 code, KOL_Sale config);

    // Event emitted when a ticket is purchased
    event TicketPurchased(address indexed buyer, uint256 indexed tier, bytes32 indexed code, uint256 ticket_id, uint256 price);

    // Event emitted when counts are updated
    event PurchasedCountUpdated(address indexed buyer, uint256 indexed tier, bytes32 indexed code, uint256 user_count, uint256 code_tier_count, uint256 tier_count, uint256 code_count, uint256 total_count);

    constructor(address initialOwner, address paymentToken_) Ownable(initialOwner) {
        paymentToken = IERC20(paymentToken_);
    }

    /** 
        @notice Function for minting licenses in the Whitelist Sale
        @dev Requirements:
        - Caller can be any
        - Params:
          - tier: Tier number (1 ~ 999)
          - amount: Number of licenses to mint
          - maxAmount: Maximum number of licenses allowed
          - merkleProof: Proof of inclusion in the Merkle tree
          - code: External message
    */
    function purchase(bytes32 code, uint256 tier, uint256 codeMaxAmount, uint256 tierMaxAmount, uint256 price, uint256 amount, bytes32[] calldata merkleProof) external {
        // Validate passing parameters
        if (tier == 0 || tier > MAX_TIER || amount == 0 || price == 0)
            revert InvalidRequest();

        // Validate request's timestamp and the requesting amount
        KOL_Sale memory config = kolSaleConfigs[code];
        address sender = _msgSender();
        if (block.timestamp < config.start || block.timestamp > config.end)
            revert SaleEventNotExist(config.start, config.end);

        if (
            config.minPrice > price ||
            tierTotalSale[tier] + amount > tierMaxAmount ||
            tierBuyerMinted[tier][sender] + amount > config.maxPerUser ||
            codeTotalSale[code] + amount > codeMaxAmount
        ) revert ExceedAllowance();

        if (!_validateProof(code, tier, codeMaxAmount, tierMaxAmount, price, merkleProof))
            revert InvalidProof();

        _purchase(sender, code, tier, amount, price);
    }

    function _purchase(address buyer, bytes32 code, uint256 tier, uint256 amount, uint256 price) internal {
        // Payment
        if (price > 0) {
            uint256 totalPayment = price * amount;
            paymentToken.safeTransferFrom(buyer, fundAddress, totalPayment);
        }

        for (uint256 i = 1; i <= amount; i++) {
            ticketCounter++;
            tierTotalSale[tier]++;
            codeTotalSale[code]++;
            tierBuyerMinted[tier][buyer]++;
            codeTierSale[code][tier]++;
            tierTicketBuyer[tier][tierTotalSale[tier]] = buyer;
            emit TicketPurchased(buyer, tier, code, tierTotalSale[tier], price);
        }

        emit PurchasedCountUpdated(buyer, tier, code, tierBuyerMinted[tier][buyer], codeTierSale[code][tier], tierTotalSale[tier], codeTotalSale[code], ticketCounter);
    }

    /** 
        @notice Update the Whitelist Sale configurations (per Tier)
        @dev Requirements:
        - Caller must be owner
        - Params:
          - tier: Tier number (1 ~ 999)
          - settings:
            - start: Starting time of the Whitelist Sale (timestamp)
            - end: Ending time of the Whitelist Sale (timestamp)
            - totalMintedAmount: Total licenses minted in the event (initial value = 0)
            - maxPerTier: Maximum number of licenses that can be purchased in this tier
            - merkleRoot: Computed hash of Merkle Tree
    */
    function setKOLConfigs(bytes32 code, KOL_Sale memory settings) external onlyOwner{
        // Note: Validation of detail settings (i.e., start/end/merkleRoot) must be done off-chain
        // if (tier == 0 || tier > MAX_TIER) revert InvalidConfig(1, MAX_TIER);

        kolSaleConfigs[code] = settings;

        emit kolSaleConfigUpdated(_msgSender(), code, settings);
    }

    /** 
        @notice Update the new address of the fund receiver
        @dev Requirements:
        - Caller must be owner
        - New updating address must be non-zero (not 0x00)
        - Params:
          - newAddress: New address of the fund receiver
    */
    function setfundAddress(address newAddress) external onlyOwner {
        if (newAddress == address(0)) revert SetAddressZero();

        fundAddress = newAddress;

        emit FundReceiverUpdated(_msgSender(), newAddress);
    }

    /** 
        @notice Set new Payment Token
        @dev Requirements:
        - Caller must be owner
        - New updating payment token must be non-zero (not 0x00)
        - Params:
          - token: New address of the payment acceptance (ERC-20)
    */
    function setPaymentToken(address token) external onlyOwner {
        if (token == address(0)) revert SetAddressZero();

        paymentToken = IERC20(token);
    }

    /** 
        @notice Validate Merkle Proof before calling purchase function
        @dev Requirements:
        - Caller can be any
        - Params:
          - tier: Tier number (1 ~ 999)
          - to: Address of the receiver
          - maxAmount: Maximum number of licenses that can be purchased (set in the Merkle Tree)
          - merkleProof: Array of connecting nodes in the Merkle Tree
    */
    function _validateProof(bytes32 code, uint256 tier, uint256 codeMaxAmount, uint256 tierMaxAmount, uint256 price, bytes32[] calldata merkleProof) public view returns (bool) {
        // Validate passing parameters
        if (tier == 0 || tier > MAX_TIER || tierMaxAmount == 0 || price == 0)
            revert InvalidRequest();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(code, tier, codeMaxAmount, tierMaxAmount, price))));
        return MerkleProof.verify(merkleProof, kolSaleConfigs[code].merkleRoot, leaf);
    }
}