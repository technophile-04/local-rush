// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { LocalRush } from "../contracts/LocalRush.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC721Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract LocalRushTest is Test {
    LocalRush private rush;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);
    address private constant DAN = address(0xDA4);

    event Boarded(
        uint256 indexed trainId, address indexed rider, uint256 indexed tokenId, string name, uint32 seat, bool teamwork
    );
    event TrainDeparted(uint256 indexed trainId, uint256 riders, uint256 departedAt);
    event DoorHanging(uint256 indexed trainId, address indexed rider, string name, uint256 until);
    event FellOff(uint256 indexed trainId, address indexed rider);

    function setUp() public {
        vm.warp(1_000);
        rush = new LocalRush(address(this));
        rush.setVirarFast(1, false);
    }

    function testPushMintsFirstSeat() public {
        vm.expectEmit(true, true, true, true, address(rush));
        emit Boarded(1, ALICE, 1, "Alice", 1, false);
        _push(ALICE, "Alice");
        assertEq(rush.ownerOf(1), ALICE);
        uint256[] memory rides = rush.ridesOf(ALICE);
        assertEq(rides.length, 1);
        assertEq(rides[0], 1);
        LocalRush.Rider[] memory riders = rush.getRiders(1);
        assertEq(riders.length, 1);
        assertEq(riders[0].rider, ALICE);
        assertEq(riders[0].name, "Alice");
        assertEq(riders[0].seat, 1);
        assertEq(riders[0].tokenId, 1);
        assertFalse(riders[0].teamwork);
        LocalRush.Status memory state = rush.status();
        assertEq(state.riders, 1);
        assertEq(state.firstBoardAt, 1_000);
        assertEq(state.departsAt, 1_120);
        assertEq(state.teamworkFrom, 24);
    }

    function testRejectsDuplicateAndBadNames() public {
        _push(ALICE, "Alice");
        vm.expectRevert(LocalRush.AlreadyOnTrain.selector);
        _push(ALICE, "Alice");
        vm.expectRevert(LocalRush.BadName.selector);
        _push(BOB, "");
        vm.expectRevert(LocalRush.BadName.selector);
        _push(BOB, "123456789012345678901");
        _push(BOB, "12345678901234567890");
        assertEq(rush.ownerOf(2), BOB);
        assertEq(rush.status().riders, 2);
    }

    function testTimeoutHasEffectiveStateBeforeNextPush() public {
        _push(ALICE, "Alice");
        vm.warp(1_119);
        assertEq(rush.status().trainId, 1);
        assertEq(rush.status().riders, 1);
        vm.warp(1_120);
        LocalRush.Status memory state = rush.status();
        assertEq(state.trainId, 2);
        assertEq(state.riders, 0);
        assertEq(state.firstBoardAt, 0);
        assertEq(state.departsAt, 0);
        assertEq(state.lastDepartedTrainId, 1);
        assertEq(state.lastDepartedRiders, 1);
        assertEq(rush.currentTrainId(), 1);
        vm.warp(1_130);
        vm.expectEmit(true, false, false, true, address(rush));
        emit TrainDeparted(1, 1, 1_120);
        _push(ALICE, "Alice again");
        assertEq(rush.currentTrainId(), 2);
        assertEq(rush.getRiders(2)[0].seat, 1);
        assertEq(rush.getRiders(2)[0].tokenId, 2);
        assertEq(rush.status().departsAt, 1_250);
        assertEq(rush.ridesOf(ALICE).length, 2);
        assertEq(rush.ridesOf(ALICE)[1], 2);
    }

    function testFullTrainDepartsImmediately() public {
        rush.setConfig(2, 120, 15, 100);
        _push(ALICE, "Alice");
        vm.expectEmit(true, false, false, true, address(rush));
        emit TrainDeparted(1, 2, 1_000);
        _push(BOB, "Bob");
        assertEq(rush.currentTrainId(), 2);
        assertEq(rush.status().riders, 0);
        assertEq(rush.status().lastDepartedTrainId, 1);
        assertEq(rush.status().lastDepartedRiders, 2);
        assertEq(rush.getRiders(1).length, 2);
        assertEq(rush.ownerOf(2), BOB);
    }

    function testTeamworkPairBoardsAtInclusiveWindowBoundary() public {
        rush.setConfig(5, 120, 15, 40);
        _push(ALICE, "Alice");
        _push(BOB, "Bob");
        vm.expectEmit(true, true, false, true, address(rush));
        emit DoorHanging(1, CAROL, "Carol", 1_015);
        _push(CAROL, "Carol");
        LocalRush.Status memory state = rush.status();
        assertEq(state.doorHanger, CAROL);
        assertEq(state.doorHangerName, "Carol");
        assertEq(state.doorHangUntil, 1_015);
        assertEq(state.riders, 2);
        vm.expectRevert(LocalRush.StillHanging.selector);
        _push(CAROL, "Carol");
        vm.warp(1_015);
        _push(DAN, "Dan");
        LocalRush.Rider[] memory riders = rush.getRiders(1);
        assertEq(riders.length, 4);
        assertEq(riders[2].rider, CAROL);
        assertEq(riders[2].name, "Carol");
        assertEq(riders[2].seat, 3);
        assertEq(riders[3].rider, DAN);
        assertEq(riders[3].seat, 4);
        assertTrue(riders[2].teamwork);
        assertTrue(riders[3].teamwork);
        assertEq(rush.ownerOf(3), CAROL);
        assertEq(rush.ownerOf(4), DAN);
        assertEq(rush.status().doorHanger, address(0));
    }

    function testExpiredHangerFallsOffAndCanHangAgain() public {
        rush.setConfig(4, 120, 15, 25);
        _push(ALICE, "Alice");
        _push(BOB, "Bob");
        vm.warp(1_016);
        assertEq(rush.status().doorHanger, address(0));
        vm.expectEmit(true, true, false, true, address(rush));
        emit FellOff(1, BOB);
        _push(CAROL, "Carol");
        assertEq(rush.status().doorHanger, CAROL);
        assertEq(rush.status().doorHangUntil, 1_031);
        assertEq(rush.status().riders, 1);
        _push(BOB, "Bob again");
        assertEq(rush.ownerOf(2), CAROL);
        assertEq(rush.ownerOf(3), BOB);
        assertEq(rush.getRiders(1)[2].name, "Bob again");
    }

    function testTeamworkCanOverflowCapacityByOne() public {
        rush.setConfig(3, 120, 15, 80);
        _push(ALICE, "Alice");
        _push(BOB, "Bob");
        _push(CAROL, "Carol");
        vm.expectEmit(true, false, false, true, address(rush));
        emit TrainDeparted(1, 4, 1_000);
        _push(DAN, "Dan");
        assertEq(rush.currentTrainId(), 2);
        assertEq(rush.getRiders(1).length, 4);
        assertEq(rush.getRiders(1)[3].seat, 4);
        assertEq(rush.status().lastDepartedRiders, 4);
        assertEq(rush.status().doorHanger, address(0));
    }

    function testTimeoutClearsHanger() public {
        rush.setConfig(4, 120, 200, 25);
        _push(ALICE, "Alice");
        _push(BOB, "Bob");
        assertEq(rush.status().doorHanger, BOB);
        vm.warp(1_120);
        assertEq(rush.status().doorHanger, address(0));
        _push(BOB, "Bob");
        assertEq(rush.ownerOf(2), BOB);
        assertEq(rush.getRiders(2)[0].seat, 1);
        assertFalse(rush.getRiders(2)[0].teamwork);
    }

    function testExpiredHangerBoardsAfterConfigChangeWithoutDuplicate() public {
        rush.setConfig(5, 120, 15, 20);
        _push(ALICE, "Alice");
        _push(BOB, "Bob");
        vm.warp(1_016);
        rush.setConfig(5, 120, 15, 60);
        _push(BOB, "Bob again");
        assertEq(rush.ownerOf(2), BOB);
        assertEq(rush.status().riders, 2);
        assertEq(rush.status().doorHanger, address(0));
        _push(CAROL, "Carol");
        _push(DAN, "Dan");
        _push(address(0xE), "E");
        assertEq(rush.ridesOf(BOB).length, 1);
        assertEq(rush.getRiders(1).length, 5);
    }

    function testVirarFastOverrideAndOwnerChecks() public {
        rush.setVirarFast(1, true);
        LocalRush.Status memory state = rush.status();
        assertTrue(state.virarFast);
        assertEq(state.destination, "VIRAR");
        assertEq(state.teamworkFrom, 15);
        rush.setConfig(4, 120, 15, 100);
        _push(ALICE, "Alice");
        _push(BOB, "Bob");
        _push(CAROL, "Carol");
        assertEq(rush.status().doorHanger, CAROL);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        vm.prank(ALICE);
        rush.setVirarFast(1, false);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        vm.prank(ALICE);
        rush.setConfig(2, 10, 5, 70);
    }

    function testBadConfigDoesNotChangeBoarding() public {
        vm.expectRevert(LocalRush.BadConfig.selector);
        rush.setConfig(0, 120, 15, 80);
        vm.expectRevert(LocalRush.BadConfig.selector);
        rush.setConfig(30, 0, 15, 80);
        vm.expectRevert(LocalRush.BadConfig.selector);
        rush.setConfig(30, 120, 15, 101);
        _push(ALICE, "Alice");
        assertEq(rush.status().departsAt, 1_120);
        assertEq(rush.status().capacity, 30);
    }

    function testTicketMetadataDecodesToJSONAndSVG() public {
        _push(ALICE, "Alice");
        string memory uri = rush.tokenURI(1);
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
        string memory json = _decode(uri, 29);
        assertEq(vm.parseJsonString(json, ".name"), unicode"Train #1 · Ticket #1");
        assertEq(vm.parseJsonUint(json, ".attributes[0].value"), 1);
        assertEq(vm.parseJsonUint(json, ".attributes[2].value"), 1);
        assertEq(vm.parseJsonString(json, ".attributes[3].value"), "Comfortable");
        assertFalse(vm.parseJsonBool(json, ".attributes[4].value"));
        string memory image = vm.parseJsonString(json, ".image");
        assertEq(_prefix(image, 26), "data:image/svg+xml;base64,");
        assertTrue(vm.contains(_decode(image, 26), "TRAIN #1"));
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 2));
        rush.tokenURI(2);
    }

    function testCrowdAtBoardingSurvivesConfigAndTransfer() public {
        rush.setConfig(10, 120, 15, 100);
        for (uint160 i = 1; i <= 10; ++i) {
            _push(address(i), "Rider");
        }
        (, uint32 seat, uint8 crowd,) = rush.tickets(3);
        assertEq(seat, 3);
        assertEq(crowd, 0);
        (,, crowd,) = rush.tickets(4);
        assertEq(crowd, 1);
        (,, crowd,) = rush.tickets(7);
        assertEq(crowd, 2);
        (,, crowd,) = rush.tickets(9);
        assertEq(crowd, 3);
        rush.setConfig(30, 120, 15, 80);
        vm.prank(address(4));
        rush.transferFrom(address(4), ALICE, 4);
        assertEq(rush.ownerOf(4), ALICE);
        assertEq(rush.ridesOf(address(4))[0], 4);
        string memory json = _decode(rush.tokenURI(4), 29);
        assertEq(vm.parseJsonString(json, ".attributes[3].value"), "Fourth seat");
    }

    function _push(address rider, string memory name) private {
        vm.prank(rider);
        rush.push(name);
    }

    function _prefix(string memory value, uint256 length) private pure returns (string memory) {
        bytes memory prefix = new bytes(length);
        for (uint256 i; i < length; ++i) {
            prefix[i] = bytes(value)[i];
        }
        return string(prefix);
    }

    function _decode(string memory uri, uint256 offset) private pure returns (string memory) {
        bytes memory data = bytes(uri);
        uint256 length = (data.length - offset) / 4 * 3;
        if (data[data.length - 1] == "=") --length;
        if (data[data.length - 2] == "=") --length;
        bytes memory decoded = new bytes(length);
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 buffer;
        uint256 bits;
        uint256 written;
        for (uint256 i = offset; i < data.length && written < length; ++i) {
            for (uint256 j; j < 64; ++j) {
                if (data[i] != alphabet[j]) continue;
                buffer = (buffer << 6) | j;
                bits += 6;
                if (bits >= 8) {
                    bits -= 8;
                    // Extract the low byte from the Base64 bit buffer.
                    // forge-lint: disable-next-line(unsafe-typecast)
                    decoded[written++] = bytes1(uint8(buffer >> bits));
                }
                break;
            }
        }
        return string(decoded);
    }
}
