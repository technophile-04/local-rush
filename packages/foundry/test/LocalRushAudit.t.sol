// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { LocalRush } from "../contracts/LocalRush.sol";

contract RejectingRider is IERC721Receiver {
    function push(LocalRush rush) external {
        rush.push("Rejecting rider");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        revert("Receiver rejects tickets");
    }
}

contract LocalRushAuditTest is Test {
    LocalRush private rush;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);

    function setUp() public {
        vm.warp(1_000);
        rush = new LocalRush(address(this));
        rush.setVirarFast(1, false);
        rush.setConfig(30, 60, 15, 80);
    }

    function testRejectingReceiverCannotBlockTeamworkOrDeparture() public {
        rush.setConfig(4, 60, 15, 50);
        RejectingRider attacker = new RejectingRider();
        _push(ALICE, "Alice");
        _push(BOB, "Bob");
        attacker.push(rush);
        assertEq(rush.status().doorHanger, address(attacker));

        _push(CAROL, "Carol");

        assertEq(rush.ownerOf(3), address(attacker));
        assertEq(rush.ownerOf(4), CAROL);
        assertEq(rush.status().trainId, 2);
        assertEq(rush.status().lastDepartedRiders, 4);
        assertEq(rush.status().doorHanger, address(0));
    }

    function testRepeatedDoorHangersCannotDelayDeparture() public {
        for (uint160 i = 1; i <= 24; ++i) {
            _push(address(i), "Rider");
        }
        for (uint160 i; i < 4; ++i) {
            vm.warp(1_010 + uint256(i) * 16);
            _push(address(100 + i), "Door hanger");
            assertEq(rush.status().riders, 24);
            assertEq(rush.status().departsAt, 1_060);
        }

        vm.warp(1_060);
        assertEq(rush.status().trainId, 2);
        assertEq(rush.status().lastDepartedRiders, 24);
        assertEq(rush.status().doorHanger, address(0));
        _push(ALICE, "Alice");

        assertEq(rush.currentTrainId(), 2);
        assertEq(rush.ownerOf(25), ALICE);
        assertEq(rush.getRiders(2)[0].seat, 1);
        assertEq(rush.status().departsAt, 1_120);
        assertEq(rush.ridesOf(address(103)).length, 0);
    }

    function testRejectedPushCannotHideEffectiveDeparture() public {
        _push(ALICE, "Alice");
        vm.warp(1_060);
        vm.expectRevert(LocalRush.BadName.selector);
        _push(BOB, "");

        assertEq(rush.currentTrainId(), 1);
        assertEq(rush.status().trainId, 2);
        assertEq(rush.status().lastDepartedTrainId, 1);
        _push(ALICE, "Alice again");
        assertEq(rush.currentTrainId(), 2);
        assertEq(rush.ownerOf(2), ALICE);
        assertEq(rush.ridesOf(ALICE).length, 2);
    }

    function testFuzzArbitraryNameBytesKeepMetadataValid(bytes20 rawName, uint8 requestedLength) public {
        uint256 length = bound(requestedLength, 1, 20);
        bytes memory riderName = new bytes(length);
        for (uint256 i; i < length; ++i) {
            riderName[i] = rawName[i];
        }
        _push(ALICE, string(riderName));
        assertEq(bytes(rush.getRiders(1)[0].name), riderName);

        string memory json = string(Base64.decode(_withoutPrefix(rush.tokenURI(1), 29)));
        assertEq(vm.parseJsonString(json, ".name"), unicode"Train #1 · Ticket #1");
        assertEq(vm.parseJsonUint(json, ".attributes[0].value"), 1);
        assertEq(vm.parseJsonUint(json, ".attributes[2].value"), 1);
        assertEq(vm.parseJsonString(json, ".attributes[3].value"), "Comfortable");
        string memory image = vm.parseJsonString(json, ".image");
        string memory svg = string(Base64.decode(_withoutPrefix(image, 26)));
        assertTrue(vm.contains(svg, '<svg xmlns="http://www.w3.org/2000/svg"'));
        assertTrue(vm.contains(svg, "TRAIN #1"));
        assertFalse(vm.contains(svg, "<script"));
    }

    function testFuzzPushSequencesKeepTicketsAndSeatsUnique(uint256 seed) public {
        rush.setConfig(6, 60, 15, 80);
        for (uint256 step; step < 40; ++step) {
            seed = uint256(keccak256(abi.encode(seed, step)));
            address commuter = address(uint160(1 + seed % 8));
            vm.warp(block.timestamp + (seed >> 8) % 31);
            LocalRush.Status memory beforePush = rush.status();
            if (rush.boarded(beforePush.trainId, commuter)) {
                vm.expectRevert(LocalRush.AlreadyOnTrain.selector);
            } else if (beforePush.doorHanger == commuter) {
                vm.expectRevert(LocalRush.StillHanging.selector);
            }
            _push(commuter, "Rider");
            assertGe(rush.status().trainId, beforePush.trainId);
        }

        uint256 totalRiders;
        uint256 expectedTokenId = 1;
        for (uint256 trainId = 1; trainId <= rush.currentTrainId(); ++trainId) {
            LocalRush.Rider[] memory riders = rush.getRiders(trainId);
            assertLe(riders.length, 7);
            totalRiders += riders.length;
            for (uint256 i; i < riders.length; ++i) {
                LocalRush.Rider memory rider = riders[i];
                assertEq(rider.seat, i + 1);
                assertEq(rider.tokenId, expectedTokenId++);
                assertTrue(rush.boarded(trainId, rider.rider));
                assertEq(rush.ownerOf(rider.tokenId), rider.rider);
                (uint256 ticketTrain, uint32 seat,, bool teamwork) = rush.tickets(rider.tokenId);
                assertEq(ticketTrain, trainId);
                assertEq(seat, rider.seat);
                assertEq(teamwork, rider.teamwork);
                for (uint256 j; j < i; ++j) {
                    assertNotEq(rider.rider, riders[j].rider);
                }
            }
        }

        uint256 totalTickets;
        for (uint160 i = 1; i <= 8; ++i) {
            uint256[] memory rides = rush.ridesOf(address(i));
            assertEq(rush.balanceOf(address(i)), rides.length);
            totalTickets += rides.length;
            for (uint256 j; j < rides.length; ++j) {
                assertEq(rush.ownerOf(rides[j]), address(i));
                if (j != 0) assertGt(rides[j], rides[j - 1]);
            }
        }
        assertEq(totalTickets, totalRiders);
        assertGt(totalTickets, 0);
    }

    function _push(address rider, string memory riderName) private {
        vm.prank(rider);
        rush.push(riderName);
    }

    function _withoutPrefix(string memory uri, uint256 offset) private pure returns (string memory) {
        bytes memory encoded = bytes(uri);
        bytes memory payload = new bytes(encoded.length - offset);
        for (uint256 i; i < payload.length; ++i) {
            payload[i] = encoded[i + offset];
        }
        return string(payload);
    }
}
