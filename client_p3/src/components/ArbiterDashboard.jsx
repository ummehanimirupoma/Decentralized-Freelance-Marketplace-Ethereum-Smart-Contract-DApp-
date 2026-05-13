import { useState, useEffect } from "react";
import { ethers } from "ethers";

const ArbiterDashboard = ({ contract }) => {
  const [disputes, setDisputes] = useState([]);
  const [adminFees, setAdminFees] = useState("0");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contract) loadDashboard();
  }, [contract]);

  const loadDashboard = async () => {
    try {
      // 1. Get Collected Fees
      const fees = await contract.availableFees();
      setAdminFees(ethers.formatEther(fees));

      // 2. Find Disputed Jobs
      const counter = await contract.jobCounter();
      const total = Number(counter);
      let foundDisputes = [];

      for (let i = 1; i <= total; i++) {
        const job = await contract.jobs(i);
        // Status 4 = Disputed
        if (Number(job.status) === 4) {
          foundDisputes.push({
            id: Number(job.id),
            title: job.title,
            amount: ethers.formatEther(job.acceptedBidAmount),
            client: job.client,
            freelancer: job.hiredFreelancer
          });
        }
      }
      setDisputes(foundDisputes);
    } catch (error) {
      console.error("Error loading arbiter data:", error);
    }
  };

  const resolveDispute = async (jobId, payFreelancer) => {
    try {
      setLoading(true);
      // True = Pay Freelancer, False = Refund Client
      const tx = await contract.resolveDispute(jobId, payFreelancer);
      await tx.wait();
      alert(payFreelancer ? "Resolved: Freelancer Paid!" : "Resolved: Client Refunded!");
      loadDashboard();
    } catch (error) {
      alert("Resolution Failed: " + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  const withdrawFees = async () => {
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const tx = await contract.withdrawFees(accounts[0], ethers.parseEther(adminFees));
      await tx.wait();
      alert("Fees Withdrawn to Wallet!");
      loadDashboard();
    } catch (error) {
      alert("Withdraw Failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", background: "#fff5f5", minHeight: "100vh" }}>
      <h2 style={{ color: "#c0392b" }}>⚖️ Arbiter Dashboard</h2>

      <div style={{ padding: "20px", background: "white", borderRadius: "8px", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", marginBottom: "30px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h4 style={{ margin: 0 }}>Platform Fees Collected</h4>
          <p style={{ fontSize: "24px", fontWeight: "bold", margin: "5px 0" }}>{adminFees} ETH</p>
        </div>
        <button 
          onClick={withdrawFees}
          disabled={loading || adminFees === "0.0"}
          style={{ padding: "10px 20px", background: "#27ae60", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
        >
          Withdraw Fees
        </button>
      </div>

      <h3>🚩 Active Disputes ({disputes.length})</h3>
      
      {disputes.length === 0 ? (
        <p>No disputes active. The platform is peaceful.</p>
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          {disputes.map((job) => (
            <div key={job.id} style={{ border: "2px solid #e74c3c", padding: "20px", borderRadius: "8px", background: "white" }}>
              <h4>Dispute on Job #{job.id}: {job.title}</h4>
              <p><strong>Locked Amount:</strong> {job.amount} ETH</p>
              <div style={{ fontSize: "0.9rem", color: "#555", marginBottom: "15px" }}>
                <p>Client: {job.client}</p>
                <p>Freelancer: {job.freelancer}</p>
              </div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={() => resolveDispute(job.id, true)}
                  disabled={loading}
                  style={{ flex: 1, padding: "12px", background: "#2980b9", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Verdict: Pay Freelancer
                </button>
                <button 
                  onClick={() => resolveDispute(job.id, false)}
                  disabled={loading}
                  style={{ flex: 1, padding: "12px", background: "#e67e22", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Verdict: Refund Client
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArbiterDashboard;


