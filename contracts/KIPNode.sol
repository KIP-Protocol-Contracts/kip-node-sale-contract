// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract KIPNode is ERC721, Ownable {
    uint256 private _nextTokenId;

    IERC20 private payToken; // payment token
    address public payTokenAddress; 

    address public KIPFundAddress; // KIP Protocol 's Fund Address

    bool public TransferEnabled;
    uint16 public MaxTierAmount;

    string public baseTokenURI;

    mapping(uint16 => uint256) public tier_price_per_token;

    mapping(uint16 => uint64) public tier_start_timestamp_public;
    mapping(uint16 => uint64) public tier_end_timestamp_public;

    mapping(uint16 => uint64) public tier_start_timestamp_whitelist;
    mapping(uint16 => uint64) public tier_end_timestamp_whitelist;

    mapping(uint16 => uint16) public tier_total_cap_public;
    mapping(uint16 => uint16) public tier_user_cap_public;

    mapping(uint16 => uint16) public tier_total_cap_whitelist;
    mapping(uint16 => bytes32) public tier_whitelist_merkle_root;

    mapping(uint16 => mapping(address => uint256)) public user_minted_amounts_whitelist;
    mapping(uint16 => mapping(address => uint256)) public user_minted_amounts_public;

    mapping(uint16 => uint16) public tier_minted_amounts_public;
    mapping(uint16 => uint16) public tier_minted_amounts_whitelist;

    mapping(address => bool) public operator;

    event OperatorChanged(address operator, bool enabled);
    event TokenMinted(bool whitelist, uint8 tier, address to, uint256 token_id, string _code);

    modifier onlyOperator(){
        require(operator[_msgSender()], "You are not the operator");
        _;
    }

    function _baseURI() internal override view returns (string memory) {
        return baseTokenURI;
    }

    function setTokenURI(string memory newuri) public onlyOwner {
        baseTokenURI = newuri;
    }

    constructor(address initialOwner, address pay_token)
        ERC721("TEST kip checker node", "KIPNODE")
        Ownable(initialOwner)
    {
        payToken = IERC20(pay_token);
        payTokenAddress = pay_token;

        KIPFundAddress = 0x6E3bbb13330102989Ac110163e4C649d0bB88777;
        TransferEnabled = false;
        MaxTierAmount = 38;

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

    function public_mint(uint8 tier, address to, uint8 _amount, string calldata _code) public {
        require(tier>0, "tier Can't BE ZERO");
        require(tier<=MaxTierAmount, "tier TOO LARGE");
        require(user_minted_amounts_public[tier][_msgSender()] + _amount <= tier_user_cap_public[tier], "Can't mint more than allowed");
        require(tier_minted_amounts_public[tier] + _amount <= tier_total_cap_public[tier], "Cannot mint more than allowed");
        require(tier_start_timestamp_public[tier] <= block.timestamp, "start_timestamp not allowed");
        require(block.timestamp <= tier_end_timestamp_public[tier], "end_timestamp not allowed");

        if(tier_price_per_token[tier]>0){
            uint256 _price = tier_price_per_token[tier]*_amount;
            require(payToken.allowance(_msgSender(), address(this)) >= _price, "Allowance is less than transfer amount");
            bool success = payToken.transferFrom(_msgSender(), address(this), _price);
            require(success, "Failed to transfer funds");
        }

        for (uint256 i = 1; i <= _amount; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
            emit TokenMinted(false, tier, to, _nextTokenId, _code);
        }
        tier_minted_amounts_public[tier] += _amount;
        user_minted_amounts_public[tier][_msgSender()] += _amount;
    }

    function whitelist_mint(uint8 tier, address to, uint8 _amount, 
                            uint256 _maxAmount, bytes32[] calldata _merkleProof) public {
        require(tier>0, "tier Can't BE ZERO");
        require(tier<=MaxTierAmount, "tier TOO LARGE");
        require(tier_minted_amounts_whitelist[tier] + _amount <= tier_total_cap_whitelist[tier], "Can't mint more than allowed");
        require(user_minted_amounts_whitelist[tier][_msgSender()] + _amount <= _maxAmount, "Cannot mint more than allowed");
        require(tier_start_timestamp_whitelist[tier] <= block.timestamp, "start_timestamp not allowed");
        require(block.timestamp <= tier_end_timestamp_whitelist[tier], "end_timestamp not allowed");

        bytes32 leaf = keccak256(abi.encodePacked(_msgSender(), _maxAmount));
        require(MerkleProof.verify(_merkleProof, tier_whitelist_merkle_root[tier], leaf), "Invalid Merkle Proof");

        for (uint256 i = 1; i <= _amount; i++) {
            _nextTokenId++;
            _safeMint(to, _nextTokenId);
            emit TokenMinted(true, tier, to, _nextTokenId, "");
        }

        tier_minted_amounts_whitelist[tier] += _amount;
        user_minted_amounts_whitelist[tier][_msgSender()] += _amount;
    }

    function setMerkleRoot(uint8 tier, bytes32 _merkleRoot) public onlyOperator {
        tier_whitelist_merkle_root[tier] = _merkleRoot;
    }

    function setDurationPublic(uint8 tier, uint64 _start, uint64 _end) public onlyOperator {
        tier_start_timestamp_public[tier] = _start;
        tier_end_timestamp_public[tier] = _end;
    }

    function setDurationWhitelist(uint8 tier, uint64 _start, uint64 _end) public onlyOperator {
        tier_start_timestamp_whitelist[tier] = _start;
        tier_end_timestamp_whitelist[tier] = _end;
    }

    function setTokenPrice(uint8 tier, uint256 _price) public onlyOperator {
        tier_price_per_token[tier] = _price;
    }

    function setUserCap(uint8 tier, uint16 _cap_public) public onlyOperator {
        tier_user_cap_public[tier] = _cap_public;
    }

    function setTotalCap(uint8 tier, uint16 _cap_public, uint16 _cap_whitelist) public onlyOperator {
        tier_total_cap_public[tier] = _cap_public;
        tier_total_cap_whitelist[tier] = _cap_whitelist;
    }

    function setTransferEnabled(bool _enabled) public onlyOperator {
        TransferEnabled = _enabled;
    }

    function setMaxTierAmount(uint16 new_address) public onlyOwner {
        MaxTierAmount = new_address;
    }

    function setKIPFundAddress(address new_address) public onlyOwner {
        KIPFundAddress = new_address;
    }

    function setPayToken(address newtoken) public onlyOwner {
        payTokenAddress = newtoken;
        payToken = IERC20(newtoken);
    }

    function setOperator(address _address, bool enabled) public onlyOwner {
        operator[_address] = enabled;
        emit OperatorChanged(_address, enabled);
    }

    function check_whitelist_mint(uint8 tier, address to,
                            uint256 _maxAmount, bytes32[] calldata _merkleProof) public view returns (bool) {

        bytes32 leaf = keccak256(abi.encodePacked(to, _maxAmount));
        return MerkleProof.verify(_merkleProof, tier_whitelist_merkle_root[tier], leaf);
    }
}
