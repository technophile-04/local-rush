// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ScaffoldETHDeploy } from "./DeployHelpers.s.sol";
import { LocalRush } from "../contracts/LocalRush.sol";

contract DeployLocalRush is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        LocalRush localRush = new LocalRush(deployer);
        deployments.push(Deployment({ name: "LocalRush", addr: address(localRush) }));
    }
}
