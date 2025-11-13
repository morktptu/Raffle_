pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract RaffleZama is ZamaEthereumConfig {
    struct Participant {
        address owner;
        euint32 encryptedAddress;
        uint256 deposit;
        bool isWinner;
    }

    struct Raffle {
        string id;
        uint256 startTime;
        uint256 endTime;
        uint256 ticketPrice;
        uint256 prizeAmount;
        address creator;
        bool isCompleted;
        euint32 encryptedWinner;
    }

    mapping(string => Raffle) public raffles;
    mapping(string => Participant[]) public participants;
    mapping(string => mapping(address => bool)) public hasParticipated;

    event RaffleCreated(string indexed raffleId, address indexed creator);
    event ParticipantAdded(string indexed raffleId, address indexed participant);
    event WinnerSelected(string indexed raffleId, euint32 encryptedWinner);

    constructor() ZamaEthereumConfig() {}

    function createRaffle(
        string calldata raffleId,
        uint256 startTime,
        uint256 endTime,
        uint256 ticketPrice,
        uint256 prizeAmount,
        bytes calldata inputProof
    ) external {
        require(bytes(raffles[raffleId].id).length == 0, "Raffle already exists");
        require(endTime > startTime, "Invalid time range");
        require(prizeAmount > 0, "Prize amount must be positive");

        raffles[raffleId] = Raffle({
        id: raffleId,
        startTime: startTime,
        endTime: endTime,
        ticketPrice: ticketPrice,
        prizeAmount: prizeAmount,
        creator: msg.sender,
        isCompleted: false,
        encryptedWinner: euint32(0)
        });

        emit RaffleCreated(raffleId, msg.sender);
    }

    function joinRaffle(
        string calldata raffleId,
        externalEuint32 encryptedAddress,
        bytes calldata inputProof
    ) external payable {
        require(bytes(raffles[raffleId].id).length > 0, "Raffle does not exist");
        require(block.timestamp >= raffles[raffleId].startTime, "Raffle not started");
        require(block.timestamp <= raffles[raffleId].endTime, "Raffle ended");
        require(!hasParticipated[raffleId][msg.sender], "Already participated");
        require(msg.value == raffles[raffleId].ticketPrice, "Incorrect ticket price");

        require(FHE.isInitialized(FHE.fromExternal(encryptedAddress, inputProof)), "Invalid encrypted input");

        euint32 encryptedAddr = FHE.fromExternal(encryptedAddress, inputProof);
        FHE.allowThis(encryptedAddr);
        FHE.makePubliclyDecryptable(encryptedAddr);

        participants[raffleId].push(Participant({
        owner: msg.sender,
        encryptedAddress: encryptedAddr,
        deposit: msg.value,
        isWinner: false
        }));

        hasParticipated[raffleId][msg.sender] = true;

        emit ParticipantAdded(raffleId, msg.sender);
    }

    function selectWinner(
        string calldata raffleId,
        bytes calldata inputProof
    ) external {
        require(bytes(raffles[raffleId].id).length > 0, "Raffle does not exist");
        require(block.timestamp > raffles[raffleId].endTime, "Raffle ongoing");
        require(!raffles[raffleId].isCompleted, "Winner already selected");
        require(msg.sender == raffles[raffleId].creator, "Only creator can select winner");

        uint256 totalParticipants = participants[raffleId].length;
        require(totalParticipants > 0, "No participants");

        euint32 randomValue;
        assembly {
            randomValue := euint32(mod(block.timestamp, totalParticipants))
        }

        euint32 encryptedWinner = participants[raffleId][uint256(FHE.decrypt(randomValue))].encryptedAddress;
        raffles[raffleId].encryptedWinner = encryptedWinner;
        raffles[raffleId].isCompleted = true;

        payable(raffles[raffleId].creator).transfer(raffles[raffleId].prizeAmount);

        emit WinnerSelected(raffleId, encryptedWinner);
    }

    function getRaffle(string calldata raffleId) external view returns (
        string memory id,
        uint256 startTime,
        uint256 endTime,
        uint256 ticketPrice,
        uint256 prizeAmount,
        address creator,
        bool isCompleted,
        euint32 encryptedWinner
    ) {
        require(bytes(raffles[raffleId].id).length > 0, "Raffle does not exist");
        Raffle storage raffle = raffles[raffleId];
        return (
        raffle.id,
        raffle.startTime,
        raffle.endTime,
        raffle.ticketPrice,
        raffle.prizeAmount,
        raffle.creator,
        raffle.isCompleted,
        raffle.encryptedWinner
        );
    }

    function getParticipants(string calldata raffleId) external view returns (Participant[] memory) {
        require(bytes(raffles[raffleId].id).length > 0, "Raffle does not exist");
        return participants[raffleId];
    }

    function getParticipantCount(string calldata raffleId) external view returns (uint256) {
        require(bytes(raffles[raffleId].id).length > 0, "Raffle does not exist");
        return participants[raffleId].length;
    }

    function hasUserParticipated(string calldata raffleId, address user) external view returns (bool) {
        require(bytes(raffles[raffleId].id).length > 0, "Raffle does not exist");
        return hasParticipated[raffleId][user];
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


