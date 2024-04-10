// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract KIPNode is ERC721, Ownable, ReentrancyGuard {
    uint256 private _nextTokenId;

    IERC20 public USDT_Token; // usdt token
    IERC20 public USDC_Token; // usdc token

    address public KIPFundAddress = 0x6E3bbb13330102989Ac110163e4C649d0bB88777; // KIP Protocol 's Fund Address

    bool public TransferEnabled = false;
    uint16 public MaxTierAmount = 38;

    string public baseTokenURI;

    struct PublicSale {
        uint256 price;
        uint32 maxPerTier;
        uint32 maxPerUser;
        uint64 mintedAmount;
        uint64 start;
        uint64 end;
    }

    struct WhitelistSale {
        bytes32 merkleRoot;
        uint32 maxPerTier;
        uint64 mintedAmount;
        uint64 start;
        uint64 end;
    }

    mapping(uint16 => PublicSale) public publicSaleConfigs;
    mapping(uint16 => WhitelistSale) public whitelistSaleConfigs;

    mapping(uint16 => mapping(address => uint256)) public whitelistUserMinted;
    mapping(uint16 => mapping(address => uint256)) public publicUserMinted;

    mapping(address => bool) public kipOperator;

    event OperatorChanged(address operator, bool enabled);
    event TokenMinted(address indexed operator, bool whitelist, uint8 tier, uint256 price, address indexed to, uint256 token_id, string code);

    modifier onlyOperator(){
        require(kipOperator[_msgSender()], "You are not the operator");
        _;
    }

    function _baseURI() internal override view returns (string memory) {
        return baseTokenURI;
    }

    function setTokenURI(string memory newuri) external onlyOwner {
        baseTokenURI = newuri;
    }

    constructor(address initialOwner, address usdt_token, address usdc_token)
        ERC721("TEST kip checker node", "KIPNODE")
        Ownable(initialOwner)
    {
        USDT_Token = IERC20(usdt_token);
        USDC_Token = IERC20(usdc_token);

        baseTokenURI = "https://node-nft.kip.pro/";
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        address previousOwner = super._update(to, tokenId, auth);
        require(TransferEnabled || previousOwner == address(0), "Transfer not enabled");
        return previousOwner;
    }

    function public_mint(uint8 tier, address to, uint8 _amount, uint8 payment_token, string calldata _code) external nonReentrant {
        require(tier<=MaxTierAmount && tier>0 && _amount>0, "11");
        PublicSale storage saleConfig = publicSaleConfigs[tier];
        require(saleConfig.maxPerTier>0, "tier price is zero");
        require(publicUserMinted[tier][_msgSender()] + _amount <= saleConfig.maxPerUser, "Can't mint more than allowed");
        require(saleConfig.mintedAmount + _amount <= saleConfig.maxPerTier, "Cann't mint more than allowed");
        require(saleConfig.start <= block.timestamp && block.timestamp <= saleConfig.end, "Timestamp not allowed");
        require(saleConfig.price>0, "Minting price is zero");

        uint256 _price = saleConfig.price*_amount;
        bool fsuccess = false;
        if(payment_token==1)
        {
            fsuccess = USDT_Token.transferFrom(_msgSender(), address(this), _price);

        }else
        {
            fsuccess = USDC_Token.transferFrom(_msgSender(), address(this), _price);
        }
        require(fsuccess, "Failed to transfer funds");

        for (uint256 i = 1; i <= _amount; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
            emit TokenMinted(_msgSender(), false, tier, saleConfig.price, to, _nextTokenId, _code);
        }
        saleConfig.mintedAmount += _amount;
        publicUserMinted[tier][_msgSender()] += _amount;
    }

    function whitelist_mint(uint8 tier, address to, uint8 _amount, 
                            uint256 _maxAmount, bytes32[] calldata _merkleProof) external nonReentrant {
        require(tier<=MaxTierAmount && tier>0 && _amount>0 && _maxAmount>0, "11");
        WhitelistSale storage saleConfig = whitelistSaleConfigs[tier];
        require(saleConfig.mintedAmount + _amount <= saleConfig.maxPerTier, "Can't mint more than allowed");
        require(whitelistUserMinted[tier][_msgSender()] + _amount <= _maxAmount, "Cann't mint more than allowed");
        require(saleConfig.start <= block.timestamp && block.timestamp <= saleConfig.end, "Timestamp not allowed");

        bytes32 leaf = keccak256(abi.encode(_msgSender(), _maxAmount));
        require(MerkleProof.verify(_merkleProof, saleConfig.merkleRoot, leaf), "Invalid Merkle Proof");

        for (uint256 i = 1; i <= _amount; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
            emit TokenMinted(_msgSender(), true, tier, 0, to, _nextTokenId, "");
        }

        saleConfig.mintedAmount += _amount;
        whitelistUserMinted[tier][_msgSender()] += _amount;
    }

    function setPublicSaleConfigs(uint8 tier, uint64 _start, uint64 _end, uint256 _price, uint32 user_cap, uint32 total_cap) external onlyOperator {
        publicSaleConfigs[tier].start = _start;
        publicSaleConfigs[tier].end = _end;
        publicSaleConfigs[tier].price = _price;
        publicSaleConfigs[tier].maxPerUser = user_cap;
        publicSaleConfigs[tier].maxPerTier = total_cap;
    }

    function setWhitelistSaleConfigs(uint8 tier, uint64 _start, uint64 _end, uint32 total_cap, bytes32 _merkleRoot) external onlyOperator {
        whitelistSaleConfigs[tier].start = _start;
        whitelistSaleConfigs[tier].end = _end;
        whitelistSaleConfigs[tier].maxPerTier = total_cap;
        whitelistSaleConfigs[tier].merkleRoot = _merkleRoot;
    }

    function setTransferEnabled(bool _enabled) external onlyOperator {
        TransferEnabled = _enabled;
    }

    function setMaxTierAmount(uint16 new_address) external onlyOwner {
        MaxTierAmount = new_address;
    }

    function setKIPFundAddress(address new_address) external onlyOwner {
        KIPFundAddress = new_address;
    }

    function setUsdtToken(address newtoken) external onlyOwner {
        USDT_Token = IERC20(newtoken);
    }

    function setUsdcToken(address newtoken) external onlyOwner {
        USDC_Token = IERC20(newtoken);
    }

    function setKipOperator(address _address, bool enabled) external onlyOwner {
        kipOperator[_address] = enabled;
        emit OperatorChanged(_address, enabled);
    }

    function check_whitelist_mint(uint8 tier, address to,
                            uint256 _maxAmount, bytes32[] calldata _merkleProof) external view returns (bool) {
        require(tier<=MaxTierAmount && tier>0 && _maxAmount>0, "11");                            
        bytes32 leaf = keccak256(abi.encode(to, _maxAmount));
        WhitelistSale storage saleConfig = whitelistSaleConfigs[tier];
        return MerkleProof.verify(_merkleProof, saleConfig.merkleRoot, leaf);
    }
}
