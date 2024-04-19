// SPDX-License-Identifier: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PaymentTokenMock is ERC20 {
    constructor() ERC20("PaymentTokenMock.sol", "Mock") {
        _mint(msg.sender, 10000000);
    }

	function decimals() public pure override returns (uint8) {
		return 6;
	}
}