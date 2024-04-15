// SPDX-License-Identifier: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PaymentTokenMock is ERC20 {
    constructor() ERC20("PaymentTokenMock.sol", "Mock") {}
}