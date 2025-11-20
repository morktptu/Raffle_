# Confidential Whitelist Raffle

Confidential Whitelist Raffle is a privacy-preserving NFT raffle application powered by Zama's Fully Homomorphic Encryption (FHE) technology. This innovative platform allows users to submit encrypted addresses, ensuring confidentiality while enabling secure and fair selection of winners through on-chain homomorphic randomization.

## The Problem

In the world of digital raffles, maintaining the privacy of participants is crucial. Traditional methods of selecting winners often expose participants' identities and data, leading to potential security risks and privacy violations. Cleartext data can be intercepted or misused, undermining the integrity of the raffle process. This situation not only threatens user privacy but also diminishes trust in the platform, as participants may fear their information is being mishandled or exposed.

## The Zama FHE Solution

Our solution employs Fully Homomorphic Encryption to ensure that participant data remains confidential throughout the entire raffle process. By utilizing FHE, we are able to perform computations on encrypted data, meaning we can retrieve randomized winners without ever exposing participant identities or their submitted data. 

Using **fhevm**, we securely process encrypted inputs, ensuring that even during selection, user information stays private. This unique approach guarantees a fair launch and prevents any manipulations or biases associated with traditional selection processes. 

## Key Features

- 🔒 **Privacy Guaranteed**: Participants' identities are always encrypted, ensuring maximum confidentiality.
- 🎲 **Fair and Transparent**: Random winner selection is done without compromising the integrity of participants' information.
- 📦 **Secure NFT Distribution**: NFTs are distributed directly to the winners in a secure manner.
- 🎁 **User-Friendly Interface**: Simple and engaging experience for participants, with clear visual cues and notifications.
- 🎉 **Wide Applicability**: Can be utilized for various raffle scenarios beyond NFTs, such as giveaways or contests.

## Technical Architecture & Stack

### Core Tech Stack:

- **Zama's FHE Libraries**: Utilizing **fhevm** for secure and efficient computations.
- **Blockchain**: Ethereum for the decentralized infrastructure.
- **Smart Contracts**: Solidity for implementing the raffle logic.
- **Frontend Framework**: React for building an intuitive user interface.

The heart of this project lies in Zama's advanced FHE technology, which serves as the backbone for securing participant data and ensuring privacy throughout the raffle process.

## Smart Contract / Core Logic

Here is a simplified example of how our smart contract interacts with Zama's FHE capabilities:solidity
// Solidity pseudocode for the Confidential Whitelist Raffle

pragma solidity ^0.8.0;

import "Zama/fhevm.sol";

contract ConfidentialRaffle {
    mapping(uint => bytes) private encryptedParticipants;
    uint public numberOfParticipants;

    function submitEncryptedAddress(bytes calldata encryptedAddress) external {
        encryptedParticipants[numberOfParticipants] = encryptedAddress;
        numberOfParticipants++;
    }

    function drawWinner() external view returns (bytes memory) {
        // Perform homomorphic random selection on encrypted data
        bytes memory winner = FHERandomSelection(encryptedParticipants, numberOfParticipants);
        return winner;
    }
}

This example outlines how we allow users to submit encrypted addresses and handle the winner selection process securely through homomorphic encryption.

## Directory Structure

Here's an overview of the project's directory structure:
ConfidentialWhitelistRaffle/
├── contracts/
│   └── ConfidentialRaffle.sol
├── scripts/
│   └── deploy.js
├── src/
│   ├── App.js
│   ├── components/
│   │   └── RaffleButton.js
│   └── styles/
│       └── App.css
├── tests/
│   └── ConfidentialRaffle.test.js
├── package.json
└── README.md

This structure ensures that all components of the application are organized, making it easy to navigate and maintain.

## Installation & Setup

### Prerequisites

To get started with the Confidential Whitelist Raffle, ensure you have the following installed on your machine:

- Node.js
- npm (Node package manager)
- Hardhat (for smart contract development)

### Install Dependencies

Run the following command to install the necessary dependencies:bash
npm install
npm install fhevm

This will install the required packages, including Zama's FHE library, enabling the core functionalities of the project.

## Build & Run

To compile and deploy the smart contracts, use the following command:bash
npx hardhat compile

After compilation, you can run the application using:bash
npm start

This will start the local development server, allowing you to interact with the Confidential Whitelist Raffle application.

## Acknowledgements

We would like to extend our deepest gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their commitment to advancing privacy technology through Fully Homomorphic Encryption has enabled us to create a secure and confidential raffle experience for users.

---

With the Confidential Whitelist Raffle, we aim to redefine the standards of privacy in the raffle ecosystem utilizing Zama's state-of-the-art technology. Join us in pioneering a new era of secure and anonymous participation in digital events.


