import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contractConfig";
import Register from "./components/Register";
import ClientDashboard from "./components/ClientDashboard";
import FreelancerDashboard from "./components/FreelancerDashboard";
import ArbiterDashboard from "./components/ArbiterDashboard";
import "./App.css"; //

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [userRole, setUserRole] = useState(null); // 0: Arbiter, 1: Client, 2: Freelancer
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- DEBUG FUNCTION (Kept for safety) ---
  const debugConnection = async () => {
    try {
      if (!window.ethereum) return alert("MetaMask not found!");
      
      // 1. Force permission request
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      // 2. Check Chain ID
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      const decimalId = parseInt(chainId, 16);
      console.log("Connected to Chain ID:", decimalId);
      
      alert(`Connected! \nAddress: ${window.ethereum.selectedAddress} \nChain ID: ${decimalId}`);
      
      // Force reload to grab new connection
      window.location.reload();
      
    } catch (error) {
      console.error(error);
      alert("Connection Error: " + error.message);
    }
  };
  // -------------------------------------------

  const init = async () => {
    if (window.ethereum) {
      try {
        // Connect to MetaMask
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const tempContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        setAccount(address);
        setContract(tempContract);

        // Fetch User Data from Blockchain
        try {
          const user = await tempContract.users(address);
          // user struct: [name, role, reputation, wallet, registered]
          // Note: If the user is NOT registered, this call still works but returns default values.
          
          if (user.registered) {
            setIsRegistered(true);
            setUserRole(Number(user.role)); 
          } else {
            setIsRegistered(false);
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
        
      } catch (error) {
        console.error("Initialization Error:", error);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    init();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => window.location.reload());
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }, []);

  // inside App.jsx

return (
  // 1. Add className="container" here
  <div className="container">
    
    {/* 2. Keep your Debug Button, but maybe style it simpler */}
    <div style={{ marginBottom: "20px", textAlign: "right" }}>
       <button onClick={debugConnection} style={{ fontSize: "12px", padding: "5px 10px", background: "#333" }}>
         🔌 {account ? `Connected: ${account.slice(0,6)}...` : "Connect Wallet"}
       </button>
    </div>

    {loading && <div style={{textAlign: "center"}}>Loading Blockchain Data...</div>}

    {!loading && contract && (
      <>
        {!isRegistered && (
          // This will now automatically look like a card because of App.css
          <div className="card"> 
            <Register contract={contract} onSuccess={() => window.location.reload()} />
          </div>
        )}

        {isRegistered && (
          <div>
            <header>
              <div>
                <h2 style={{margin: 0}}>Freelance Marketplace</h2>
              </div>
              <div className="badge blue">
                {["Arbiter", "Client", "Freelancer"][userRole]} View
              </div>
            </header>

            {/* These components will inherit the card styles from CSS */}
            {userRole === 0 && <ArbiterDashboard contract={contract} />}
            {userRole === 1 && <ClientDashboard contract={contract} account={account} />}
            {userRole === 2 && <FreelancerDashboard contract={contract} account={account} />}
          </div>
        )}
      </>
    )}
  </div>
);



}

export default App;

