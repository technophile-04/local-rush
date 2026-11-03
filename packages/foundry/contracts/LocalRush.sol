// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract LocalRush is ERC721, Ownable {
    using Strings for uint256;
    using SafeCast for uint256;

    struct Rider {
        address rider;
        string name;
        uint32 seat;
        bool teamwork;
        uint256 tokenId;
    }

    struct Status {
        uint256 trainId;
        uint256 firstBoardAt;
        uint256 departsAt;
        uint256 riders;
        uint32 capacity;
        uint256 teamworkFrom;
        address doorHanger;
        string doorHangerName;
        uint256 doorHangUntil;
        string destination;
        bool virarFast;
        uint256 lastDepartedTrainId;
        uint256 lastDepartedRiders;
    }

    struct Ticket {
        uint256 trainId;
        uint32 seat;
        uint8 crowd;
        bool teamwork;
    }

    struct Hanger {
        address rider;
        string name;
        uint256 since;
    }

    error BadName();
    error AlreadyOnTrain();
    error StillHanging();
    error BadConfig();

    event Boarded(
        uint256 indexed trainId, address indexed rider, uint256 indexed tokenId, string name, uint32 seat, bool teamwork
    );
    event TrainDeparted(uint256 indexed trainId, uint256 riders, uint256 departedAt);
    event DoorHanging(uint256 indexed trainId, address indexed rider, string name, uint256 until);
    event FellOff(uint256 indexed trainId, address indexed rider);

    uint32 public capacity = 30;
    uint32 public tripDuration = 120;
    uint32 public teamworkWindow = 15;
    uint8 public teamworkPct = 80;
    uint256 public currentTrainId = 1;
    uint256 public lastDepartedTrainId;
    uint256 public lastDepartedRiders;
    uint256 private nextTokenId = 1;
    Hanger private hanger;

    mapping(uint256 => uint256) public firstBoardAt;
    mapping(uint256 => mapping(address => bool)) public boarded;
    mapping(uint256 => Rider[]) private ridersByTrain;
    mapping(address => uint256[]) private mintedRides;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => bool) private hasVirarOverride;
    mapping(uint256 => bool) private virarOverride;

    constructor(address initialOwner) ERC721("Mumbai Local Rush Ticket", "RUSH") Ownable(initialOwner) { }

    function setConfig(uint32 capacity_, uint32 tripDuration_, uint32 teamworkWindow_, uint8 teamworkPct_)
        external
        onlyOwner
    {
        // Leave room for the extra rider when a teamwork pair fills the train.
        if (capacity_ == 0 || capacity_ == type(uint32).max || tripDuration_ == 0 || teamworkPct_ > 100) {
            revert BadConfig();
        }
        capacity = capacity_;
        tripDuration = tripDuration_;
        teamworkWindow = teamworkWindow_;
        teamworkPct = teamworkPct_;
    }

    function setVirarFast(uint256 trainId, bool enabled) external onlyOwner {
        hasVirarOverride[trainId] = true;
        virarOverride[trainId] = enabled;
    }

    function push(string calldata riderName) external {
        uint256 trainId = currentTrainId;
        if (_isDue(trainId)) {
            _depart(firstBoardAt[trainId] + tripDuration);
            trainId = currentTrainId;
        }
        if (bytes(riderName).length == 0 || bytes(riderName).length > 20) revert BadName();
        if (boarded[trainId][msg.sender]) revert AlreadyOnTrain();
        bool liveHanger = hanger.rider != address(0) && block.timestamp <= hanger.since + teamworkWindow;
        if (liveHanger && hanger.rider == msg.sender) revert StillHanging();

        if (ridersByTrain[trainId].length < _teamworkFrom(trainId)) {
            _board(msg.sender, riderName, false);
        } else if (liveHanger) {
            _board(hanger.rider, hanger.name, true);
            _board(msg.sender, riderName, true);
            delete hanger;
        } else {
            if (hanger.rider != address(0)) emit FellOff(trainId, hanger.rider);
            hanger = Hanger({ rider: msg.sender, name: riderName, since: block.timestamp });
            emit DoorHanging(trainId, msg.sender, riderName, block.timestamp + teamworkWindow);
        }

        if (ridersByTrain[trainId].length >= capacity) _depart(block.timestamp);
    }

    function status() external view returns (Status memory state) {
        uint256 trainId = currentTrainId;
        bool due = _isDue(trainId);
        state.lastDepartedTrainId = due ? trainId : lastDepartedTrainId;
        state.lastDepartedRiders = due ? ridersByTrain[trainId].length : lastDepartedRiders;
        if (due) ++trainId;
        state.trainId = trainId;
        state.capacity = capacity;
        state.teamworkFrom = _teamworkFrom(trainId);
        (state.destination, state.virarFast) = train(trainId);
        if (!due) {
            state.riders = ridersByTrain[trainId].length;
            state.firstBoardAt = firstBoardAt[trainId];
            if (state.riders != 0) state.departsAt = state.firstBoardAt + tripDuration;
            if (hanger.rider != address(0) && block.timestamp <= hanger.since + teamworkWindow) {
                state.doorHanger = hanger.rider;
                state.doorHangerName = hanger.name;
                state.doorHangUntil = hanger.since + teamworkWindow;
            }
        }
    }

    function getRiders(uint256 trainId) external view returns (Rider[] memory) {
        return ridersByTrain[trainId];
    }

    /// @notice Lists tickets minted by the rider, even after the rider transfers them.
    function ridesOf(address rider) external view returns (uint256[] memory) {
        return mintedRides[rider];
    }

    function train(uint256 trainId) public view returns (string memory destination, bool virarFast) {
        uint256 seed = uint256(keccak256(abi.encode(address(this), trainId)));
        virarFast = hasVirarOverride[trainId] ? virarOverride[trainId] : seed % 7 == 0;
        string[9] memory stations =
            ["CHURCHGATE", "VIRAR", "BORIVALI", "ANDHERI", "BANDRA", "DADAR", "MALAD", "BHAYANDAR", "GOREGAON"];
        destination = virarFast ? "VIRAR" : stations[seed % stations.length];
    }

    function _teamworkFrom(uint256 trainId) private view returns (uint256) {
        (, bool virarFast) = train(trainId);
        return uint256(capacity) * (virarFast ? 50 : teamworkPct) / 100;
    }

    function _isDue(uint256 trainId) private view returns (bool) {
        return ridersByTrain[trainId].length != 0 && block.timestamp >= firstBoardAt[trainId] + tripDuration;
    }

    function _depart(uint256 departedAt) private {
        lastDepartedTrainId = currentTrainId;
        lastDepartedRiders = ridersByTrain[currentTrainId].length;
        emit TrainDeparted(currentTrainId, lastDepartedRiders, departedAt);
        ++currentTrainId;
        delete hanger;
    }

    function _board(address rider, string memory riderName, bool teamwork) private {
        uint256 trainId = currentTrainId;
        uint32 seat = (ridersByTrain[trainId].length + 1).toUint32();
        uint256 tokenId = nextTokenId++;
        uint8 crowd = uint256(seat) * 100 < uint256(capacity) * 40
            ? 0
            : uint256(seat) * 100 < uint256(capacity) * 70 ? 1 : uint256(seat) * 100 < uint256(capacity) * 90 ? 2 : 3;
        if (seat == 1) firstBoardAt[trainId] = block.timestamp;
        if (hanger.rider == rider) delete hanger;
        boarded[trainId][rider] = true;
        ridersByTrain[trainId].push(
            Rider({ rider: rider, name: riderName, seat: seat, teamwork: teamwork, tokenId: tokenId })
        );
        tickets[tokenId] = Ticket({ trainId: trainId, seat: seat, crowd: crowd, teamwork: teamwork });
        mintedRides[rider].push(tokenId);
        _mint(rider, tokenId);
        emit Boarded(trainId, rider, tokenId, riderName, seat, teamwork);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Ticket memory ticket = tickets[tokenId];
        (string memory destination, bool virarFast) = train(ticket.trainId);
        bool mahim = uint256(keccak256(abi.encode(ticket.trainId, ticket.seat))) % 8 == 0;
        string[4] memory crowds = ["Comfortable", "Fourth seat", "Feet off floor", "Door pe latak raha"];
        string memory attributes = string.concat(
            '{"trait_type":"Train","value":',
            ticket.trainId.toString(),
            '},{"trait_type":"Destination","value":"',
            destination,
            '"},{"trait_type":"Seat","value":',
            uint256(ticket.seat).toString(),
            '},{"trait_type":"Crowd","value":"',
            crowds[ticket.crowd],
            '"}'
        );
        attributes = string.concat(
            attributes,
            ',{"trait_type":"Teamwork Push","value":',
            ticket.teamwork ? "true" : "false",
            '},{"trait_type":"Mahim","value":"',
            mahim ? "Bhai, Mahim nahi!" : "Made it past Mahim",
            '"},{"trait_type":"Virar Fast","value":',
            virarFast ? "true" : "false",
            "}"
        );
        string memory image =
            Base64.encode(bytes(_ticketSvg(ticket, destination, virarFast, mahim, crowds[ticket.crowd])));
        string memory json = string.concat(
            unicode'{"name":"Train #',
            ticket.trainId.toString(),
            unicode" · Ticket #",
            tokenId.toString(),
            '","description":"Mumbai Local Rush. One push, one ride. Devcon 8 Mumbai.","attributes":[',
            attributes,
            '],"image":"data:image/svg+xml;base64,',
            image,
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _ticketSvg(
        Ticket memory ticket,
        string memory destination,
        bool virarFast,
        bool mahim,
        string memory crowd
    ) private pure returns (string memory) {
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 440">',
            '<rect x="5" y="5" width="670" height="430" rx="8" fill="#fff0b5" stroke="#493c28" stroke-width="3"/>',
            '<g fill="#392d20" font-family="monospace"><text x="30" y="44" font-size="19">',
            unicode"WESTERN RAILWAY · DEVCON 8 SPECIAL</text>",
            '<path d="M25 65H655M25 345H655" stroke="#493c28" stroke-dasharray="5 4"/>',
            '<text x="30" y="132" font-size="54" font-weight="bold">TRAIN #',
            ticket.trainId.toString(),
            "</text>",
            unicode'<text x="30" y="184" font-size="25">CHURCHGATE → ',
            destination,
            "</text>"
        );
        svg = string.concat(
            svg,
            unicode'<text x="30" y="225" font-size="21">II CLASS · ADULT · 1 PUSH</text>',
            unicode'<text x="30" y="262" font-size="20">FARE ₹0.00 (paymaster ne bhara)</text>',
            '<text x="30" y="302" font-size="21">SEAT ',
            uint256(ticket.seat).toString(),
            " / ",
            crowd,
            "</text></g>",
            '<g fill="#a42d28" font-family="monospace" font-size="18" font-weight="bold">',
            ticket.teamwork ? '<text x="30" y="376">TEAMWORK PUSH</text>' : "",
            mahim ? '<text x="350" y="376" transform="rotate(-6 350 376)">MAHIM NAHI</text>' : "",
            virarFast ? '<text x="30" y="411">8:15 VIRAR FAST</text>' : "",
            "</g></svg>"
        );
        return svg;
    }
}
