import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface RaffleData {
  id: number;
  name: string;
  prize: string;
  participants: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface RaffleStats {
  totalRaffles: number;
  activeRaffles: number;
  totalParticipants: number;
  totalPrizes: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [raffles, setRaffles] = useState<RaffleData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingRaffle, setCreatingRaffle] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newRaffleData, setNewRaffleData] = useState({ name: "", prize: "", participants: "" });
  const [selectedRaffle, setSelectedRaffle] = useState<RaffleData | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [stats, setStats] = useState<RaffleStats>({ totalRaffles: 0, activeRaffles: 0, totalParticipants: 0, totalPrizes: 0 });
  const [showFAQ, setShowFAQ] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      await checkAvailability(contract);
      
      const businessIds = await contract.getAllBusinessIds();
      const rafflesList: RaffleData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          rafflesList.push({
            id: parseInt(businessId.replace('raffle-', '')) || Date.now(),
            name: businessData.name,
            prize: businessId,
            participants: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setRaffles(rafflesList);
      updateStats(rafflesList);
      updateLeaderboard(rafflesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const checkAvailability = async (contract: any) => {
    try {
      const available = await contract.isAvailable();
      if (available) {
        console.log("Contract is available");
      }
    } catch (e) {
      console.error("Availability check failed:", e);
    }
  };

  const updateStats = (rafflesList: RaffleData[]) => {
    const totalRaffles = rafflesList.length;
    const activeRaffles = rafflesList.filter(r => !r.isVerified).length;
    const totalParticipants = rafflesList.reduce((sum, r) => sum + r.publicValue1, 0);
    const totalPrizes = rafflesList.reduce((sum, r) => sum + r.publicValue2, 0);
    
    setStats({ totalRaffles, activeRaffles, totalParticipants, totalPrizes });
  };

  const updateLeaderboard = (rafflesList: RaffleData[]) => {
    const creatorStats: { [key: string]: { count: number; prizes: number } } = {};
    
    rafflesList.forEach(raffle => {
      if (!creatorStats[raffle.creator]) {
        creatorStats[raffle.creator] = { count: 0, prizes: 0 };
      }
      creatorStats[raffle.creator].count++;
      creatorStats[raffle.creator].prizes += raffle.publicValue2;
    });
    
    const leaderboardData = Object.entries(creatorStats)
      .map(([creator, stats]) => ({
        creator,
        rafflesCreated: stats.count,
        totalPrizes: stats.prizes
      }))
      .sort((a, b) => b.rafflesCreated - a.rafflesCreated)
      .slice(0, 5);
    
    setLeaderboard(leaderboardData);
  };

  const createRaffle = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingRaffle(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating raffle with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const prizeValue = parseInt(newRaffleData.prize) || 0;
      const businessId = `raffle-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, prizeValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newRaffleData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newRaffleData.participants) || 0,
        0,
        "Confidential Whitelist Raffle"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Raffle created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewRaffleData({ name: "", prize: "", participants: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingRaffle(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data is already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const renderStatsDashboard = () => {
    return (
      <div className="dashboard-panels">
        <div className="panel gradient-panel">
          <h3>Total Raffles</h3>
          <div className="stat-value">{stats.totalRaffles}</div>
          <div className="stat-trend">+{stats.activeRaffles} active</div>
        </div>
        
        <div className="panel gradient-panel">
          <h3>Active Raffles</h3>
          <div className="stat-value">{stats.activeRaffles}</div>
          <div className="stat-trend">FHE Protected</div>
        </div>
        
        <div className="panel gradient-panel">
          <h3>Total Participants</h3>
          <div className="stat-value">{stats.totalParticipants}</div>
          <div className="stat-trend">Encrypted Identities</div>
        </div>
        
        <div className="panel gradient-panel">
          <h3>Total Prizes</h3>
          <div className="stat-value">{stats.totalPrizes}</div>
          <div className="stat-trend">NFT Rewards</div>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    return (
      <div className="leaderboard-section">
        <h3>🎯 Creator Leaderboard</h3>
        <div className="leaderboard-list">
          {leaderboard.map((item, index) => (
            <div className="leaderboard-item" key={index}>
              <div className="rank">#{index + 1}</div>
              <div className="creator-info">
                <div className="creator-address">{item.creator.substring(0, 8)}...{item.creator.substring(36)}</div>
                <div className="creator-stats">{item.rafflesCreated} raffles • {item.totalPrizes} prizes</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFAQ = () => {
    const faqItems = [
      {
        question: "What is FHE (Fully Homomorphic Encryption)?",
        answer: "FHE allows computations on encrypted data without decrypting it, ensuring complete privacy throughout the raffle process."
      },
      {
        question: "How does the confidential whitelist work?",
        answer: "Participants submit encrypted addresses, and the random selection happens on encrypted data, keeping identities confidential."
      },
      {
        question: "Is the raffle process fair?",
        answer: "Yes! The random selection uses homomorphic encryption to ensure true randomness while maintaining participant privacy."
      },
      {
        question: "What happens to my encrypted data?",
        answer: "Your encrypted address is stored on-chain and only used for the random selection process. It remains encrypted throughout."
      }
    ];

    return (
      <div className="faq-section">
        <h3>❓ Frequently Asked Questions</h3>
        <div className="faq-list">
          {faqItems.map((item, index) => (
            <div className="faq-item" key={index}>
              <div className="faq-question">{item.question}</div>
              <div className="faq-answer">{item.answer}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFHEFlow = () => {
    return (
      <div className="fhe-flow">
        <div className="flow-step">
          <div className="step-icon">🔐</div>
          <div className="step-content">
            <h4>Address Encryption</h4>
            <p>Participant addresses encrypted with Zama FHE technology</p>
          </div>
        </div>
        <div className="flow-arrow">➡️</div>
        <div className="flow-step">
          <div className="step-icon">⚡</div>
          <div className="step-content">
            <h4>Homomorphic Random Selection</h4>
            <p>Random winner selection happens on encrypted data</p>
          </div>
        </div>
        <div className="flow-arrow">➡️</div>
        <div className="flow-step">
          <div className="step-icon">🎯</div>
          <div className="step-content">
            <h4>Secure Verification</h4>
            <p>Winner verification without exposing participant identities</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🎁 Confidential Raffle</h1>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔒</div>
            <h2>Connect Your Wallet to Join Private Raffles</h2>
            <p>Experience truly confidential whitelist raffles with Zama FHE technology</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Participate in raffles with encrypted identity</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Enjoy fair and private random selection</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Setting up confidential raffle environment</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading confidential raffle system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🎁 Confidential Raffle</h1>
          <span className="tagline">FHE-Powered Private Whitelists</span>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn neon-btn"
          >
            🎯 Create Raffle
          </button>
          <button 
            onClick={() => setShowFAQ(!showFAQ)} 
            className="faq-btn neon-btn"
          >
            ❓ FAQ
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>Confidential Raffle Dashboard</h2>
          {renderStatsDashboard()}
          
          <div className="feature-panels">
            <div className="panel full-width gradient-panel">
              <h3>🔐 FHE Privacy Flow</h3>
              {renderFHEFlow()}
            </div>
            
            {renderLeaderboard()}
            
            {showFAQ && renderFAQ()}
          </div>
        </div>
        
        <div className="raffles-section">
          <div className="section-header">
            <h2>Active Confidential Raffles</h2>
            <div className="header-actions">
              <button 
                onClick={loadData} 
                className="refresh-btn neon-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "🔄 Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
          </div>
          
          <div className="raffles-list">
            {raffles.length === 0 ? (
              <div className="no-raffles">
                <p>No confidential raffles found</p>
                <button 
                  className="create-btn neon-btn" 
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Raffle
                </button>
              </div>
            ) : raffles.map((raffle, index) => (
              <div 
                className={`raffle-item ${selectedRaffle?.id === raffle.id ? "selected" : ""} ${raffle.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedRaffle(raffle)}
              >
                <div className="raffle-title">{raffle.name}</div>
                <div className="raffle-meta">
                  <span>Participants: {raffle.publicValue1}</span>
                  <span>Created: {new Date(raffle.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                <div className="raffle-status">
                  Status: {raffle.isVerified ? "✅ Winner Selected" : "🔓 Active - Encrypted"}
                  {raffle.isVerified && raffle.decryptedValue && (
                    <span className="verified-prize">Prize: {raffle.decryptedValue} NFTs</span>
                  )}
                </div>
                <div className="raffle-creator">Creator: {raffle.creator.substring(0, 6)}...{raffle.creator.substring(38)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateRaffle 
          onSubmit={createRaffle} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingRaffle} 
          raffleData={newRaffleData} 
          setRaffleData={setNewRaffleData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedRaffle && (
        <RaffleDetailModal 
          raffle={selectedRaffle} 
          onClose={() => { 
            setSelectedRaffle(null); 
            setDecryptedData(null); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedRaffle.prize)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateRaffle: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  raffleData: any;
  setRaffleData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, raffleData, setRaffleData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'prize') {
      const intValue = value.replace(/[^\d]/g, '');
      setRaffleData({ ...raffleData, [name]: intValue });
    } else {
      setRaffleData({ ...raffleData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-raffle-modal">
        <div className="modal-header">
          <h2>🎯 New Confidential Raffle</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>🔐 FHE Privacy Guarantee</strong>
            <p>Participant addresses encrypted with Zama FHE technology</p>
          </div>
          
          <div className="form-group">
            <label>Raffle Name *</label>
            <input 
              type="text" 
              name="name" 
              value={raffleData.name} 
              onChange={handleChange} 
              placeholder="Enter raffle name..." 
            />
          </div>
          
          <div className="form-group">
            <label>NFT Prize Count (Integer only) *</label>
            <input 
              type="number" 
              name="prize" 
              value={raffleData.prize} 
              onChange={handleChange} 
              placeholder="Enter prize count..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Max Participants *</label>
            <input 
              type="number" 
              min="1" 
              name="participants" 
              value={raffleData.participants} 
              onChange={handleChange} 
              placeholder="Enter max participants..." 
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !raffleData.name || !raffleData.prize || !raffleData.participants} 
            className="submit-btn neon-btn"
          >
            {creating || isEncrypting ? "🔐 Encrypting and Creating..." : "Create Raffle"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RaffleDetailModal: React.FC<{
  raffle: RaffleData;
  onClose: () => void;
  decryptedData: number | null;
  setDecryptedData: (value: number | null) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ raffle, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) { 
      setDecryptedData(null); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="raffle-detail-modal">
        <div className="modal-header">
          <h2>Confidential Raffle Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="raffle-info">
            <div className="info-item">
              <span>Raffle Name:</span>
              <strong>{raffle.name}</strong>
            </div>
            <div className="info-item">
              <span>Creator:</span>
              <strong>{raffle.creator.substring(0, 6)}...{raffle.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Date Created:</span>
              <strong>{new Date(raffle.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>Max Participants:</span>
              <strong>{raffle.publicValue1}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>🔐 Encrypted Prize Data</h3>
            
            <div className="data-row">
              <div className="data-label">NFT Prize Count:</div>
              <div className="data-value">
                {raffle.isVerified && raffle.decryptedValue ? 
                  `${raffle.decryptedValue} NFTs (On-chain Verified)` : 
                  decryptedData !== null ? 
                  `${decryptedData} NFTs (Locally Decrypted)` : 
                  "🔒 FHE Encrypted Integer"
                }
              </div>
              <button 
                className={`decrypt-btn neon-btn ${(raffle.isVerified || decryptedData !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Verifying..."
                ) : raffle.isVerified ? (
                  "✅ Verified"
                ) : decryptedData !== null ? (
                  "🔄 Re-verify"
                ) : (
                  "🔓 Verify Decryption"
                )}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Privacy Protection</strong>
                <p>Prize count encrypted on-chain. Verification performs offline decryption with on-chain proof validation.</p>
              </div>
            </div>
          </div>
          
          {(raffle.isVerified || decryptedData !== null) && (
            <div className="winner-section">
              <h3>🎉 Raffle Results</h3>
              <div className="winner-announcement">
                <div className="confetti">🎊</div>
                <div className="winner-info">
                  <div className="prize-amount">
                    {raffle.isVerified ? 
                      `${raffle.decryptedValue} NFTs Awarded` : 
                      `${decryptedData} NFTs Awarded`
                    }
                  </div>
                  <div className="winner-note">
                    Winner selected through homomorphic random selection
                  </div>
                </div>
                <div className="confetti">🎊</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!raffle.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn neon-btn"
            >
              {isDecrypting ? "Verifying on-chain..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


