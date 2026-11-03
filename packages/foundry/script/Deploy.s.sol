// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { DeployLocalRush } from "./DeployLocalRush.s.sol";

contract DeployScript {
    function run() external {
        new DeployLocalRush().run();
    }
}
