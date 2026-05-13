import { useState, useEffect } from "react";
import { ethers } from "ethers";

const ClientDashboard = ({ contract, account }) => {
  const [myJobs, setMyJobs] = useState([]);
  const [jobBids, setJobBids] = useState({}); // Stores bids: { jobId: [bid1, bid2] }
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "Development",
    budget: "",
    deadline: "",
  });

  useEffect(() => {
    if (contract && account) {
        loadMyJobs();
    }
  }, [contract, account]);

  const loadMyJobs = async () => {
    try {
      const counter = await contract.jobCounter();
      const total = Number(counter);
      let list = [];

      for (let i = 1; i <= total; i++) {
        const job = await contract.jobs(i);
        
        // Only show jobs created by ME
        if (job.client.toLowerCase() === account.toLowerCase()) {
          list.push({
            id: Number(job.id),
            title: job.title,
            status: Number(job.status), // 0:Open, 1:InProgress, 2:Completed, 3:Closed, 4:Disputed
            budget: ethers.formatEther(job.budget),
            freelancer: job.hiredFreelancer
          });
        }
      }
      setMyJobs(list.reverse()); // Newest first
    } catch (error) {
      console.error("Error loading jobs:", error);
    }
  };

  // --- NEW: Fetch Bids + Freelancer Details (Name & Reputation) ---
  const fetchBids = async (jobId) => {
    try {
      // Toggle logic: hide if already showing
      if (jobBids[jobId]) {
        setJobBids(prev => {
            const newState = { ...prev };
            delete newState[jobId];
            return newState;
        });
        return;
      }

      setLoading(true);
      const count = await contract.getBidCount(jobId);
      const bidCount = Number(count);
      let bids = [];

      for (let i = 0; i < bidCount; i++) {
        const bid = await contract.getBid(jobId, i);
        
        if (bid.exists) {
            // 1. Fetch the Freelancer's Profile to get Name & Reputation
            const freelancerUser = await contract.users(bid.freelancer);
            
            bids.push({
                index: i,
                freelancerAddress: bid.freelancer,
                name: freelancerUser.name,               // <--- NEW
                reputation: Number(freelancerUser.reputation), // <--- NEW
                amountWei: bid.amount,
                amountEth: ethers.formatEther(bid.amount),
                days: Number(bid.proposedTime) / (24 * 60 * 60)
            });
        }
      }
      
      setJobBids(prev => ({ ...prev, [jobId]: bids }));

    } catch (error) {
      console.error("Error fetching bids:", error);
      alert("Could not load bids.");
    } finally {
        setLoading(false);
    }
  };

  const hireFreelancer = async (jobId, bidIndex, amountWei) => {
    try {
        setLoading(true);
        // We must send the exact bid amount to escrow
        const tx = await contract.hireFreelancer(jobId, bidIndex, { value: amountWei });
        await tx.wait();
        
        alert("Freelancer Hired! Funds locked in Escrow.");
        // Close bid view and refresh list
        setJobBids(prev => {
            const newState = { ...prev };
            delete newState[jobId];
            return newState;
        });
        loadMyJobs(); 
    } catch (error) {
        console.error("Hire Error:", error);
        alert("Hire Failed: " + (error.reason || error.message));
    } finally {
        setLoading(false);
    }
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!formData.title || !formData.budget || !formData.deadline) return alert("Fill all fields");

    try {
      setLoading(true);
      const budgetInWei = ethers.parseEther(formData.budget);
      const deadlineTimestamp = Math.floor(new Date(formData.deadline).getTime() / 1000);
      
      // Ensure deadline is future
      const now = Math.floor(Date.now() / 1000);
      if(deadlineTimestamp <= now) return alert("Deadline must be in the future");

      const tx = await contract.postJob(formData.title, formData.category, budgetInWei, deadlineTimestamp);
      await tx.wait();
      
      alert("Job Posted!");
      setFormData({ title: "", category: "Development", budget: "", deadline: "" });
      loadMyJobs(); 
    } catch (error) {
      alert("Failed: " + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  const approveWork = async (jobId) => {
    try {
      setLoading(true);
      const tx = await contract.approveWork(jobId);
      await tx.wait();
      alert("Work Approved! Money released to freelancer.");
      loadMyJobs();
    } catch (error) { alert("Error: " + error.message); } finally { setLoading(false); }
  };

  // --- NEW: Raise Dispute Function ---
  const raiseDispute = async (jobId) => {
    if(!window.confirm("Are you sure? This will lock funds and summon the Arbiter.")) return;
    try {
      setLoading(true);
      const tx = await contract.raiseDispute(jobId);
      await tx.wait();
      alert("Dispute Raised. Arbiter has been notified.");
      loadMyJobs();
    } catch (error) { 
      alert("Error: " + (error.reason || error.message)); 
    } finally { 
      setLoading(false); 
    }
  };

  const getStatusLabel = (s) => ["Open", "In Progress", "Completed (Waiting Approval)", "Closed", "Disputed", "Resolved"][s];
  const getStatusBadgeColor = (s) => {
      if(s===0) return "#d1fae5"; // Green
      if(s===4) return "#fee2e2"; // Red
      return "#dbeafe";           // Blue
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      
      {/* 1. POST JOB FORM */}
      <div style={{ background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "30px" }}>
        <h3>🚀 Post a New Job</h3>
        <form onSubmit={handlePostJob}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Title</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})} 
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "15px" }}>
            <div>
                <label style={{ display: "block", marginBottom: "5px" }}>Category</label>
                <select 
                  value={formData.category} 
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                    <option>Development</option><option>Design</option><option>Marketing</option>
                </select>
            </div>
            <div>
                <label style={{ display: "block", marginBottom: "5px" }}>Budget (ETH)</label>
                <input 
                  type="number" step="0.0001" 
                  value={formData.budget} 
                  onChange={(e) => setFormData({...formData, budget: e.target.value})} 
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
            </div>
          </div>
          
          <div style={{ marginBottom: "15px" }}>
             <label style={{ display: "block", marginBottom: "5px" }}>Deadline</label>
             <input 
               type="date" 
               value={formData.deadline} 
               onChange={(e) => setFormData({...formData, deadline: e.target.value})} 
               style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
             />
          </div>
          
          <button type="submit" disabled={loading} style={{ background: "#4f46e5", color: "white", padding: "10px 20px", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            {loading ? "Posting..." : "Post Job"}
          </button>
        </form>
      </div>

      {/* 2. MY JOBS LIST */}
      <h3>📋 My Job Listings</h3>
      {myJobs.length === 0 ? <p>No jobs posted yet.</p> : (
        <div style={{ display: "grid", gap: "20px" }}>
          {myJobs.map((job) => (
            <div key={job.id} style={{ border: "1px solid #e5e7eb", padding: "15px", borderRadius: "8px", background: "white" }}>
              
              {/* Job Header */}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <div>
                     <h4 style={{margin: "0 0 5px 0"}}>#{job.id}: {job.title}</h4>
                     <span style={{fontSize:'0.9rem', color:'#666'}}>Budget: {job.budget} ETH</span>
                 </div>
                 <span style={{ 
                     background: getStatusBadgeColor(job.status), 
                     padding: "5px 10px", 
                     borderRadius: "15px", 
                     fontSize: "0.8rem", 
                     fontWeight: "bold" 
                 }}>
                     {getStatusLabel(job.status)}
                 </span>
              </div>

              {/* ACTION AREA */}
              <div style={{ marginTop: "15px", borderTop:"1px dashed #ddd", paddingTop:"10px" }}>
                
                {/* A. VIEW BIDS (Only if Open) */}
                {job.status === 0 && (
                  <div>
                     <button 
                       onClick={() => fetchBids(job.id)} 
                       disabled={loading}
                       style={{ background: "transparent", border: "1px solid #4f46e5", color: "#4f46e5", padding: "5px 10px", borderRadius: "4px", cursor: "pointer" }}
                     >
                        {jobBids[job.id] ? "Hide Bids" : "View Bids / Hire"}
                     </button>
                     
                     {/* Bids Dropdown List */}
                     {jobBids[job.id] && (
                         <div style={{ marginTop: "10px", background: "#f9fafb", padding: "10px", borderRadius: "5px" }}>
                             {jobBids[job.id].length === 0 ? <p style={{fontSize:"0.9rem", margin:0}}>No bids yet.</p> : (
                                 jobBids[job.id].map((bid) => (
                                     <div key={bid.index} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px", borderBottom:"1px solid #eee", paddingBottom:"5px" }}>
                                         <div style={{fontSize:"0.9rem"}}>
                                             {/* Display Name and Reputation */}
                                             <strong>{bid.name}</strong> (Rep: {bid.reputation})
                                             <br/>
                                             <span style={{color: "#2563eb"}}>{bid.amountEth} ETH</span> in {bid.days} Days
                                         </div>
                                         <button 
                                             onClick={() => hireFreelancer(job.id, bid.index, bid.amountWei)}
                                             disabled={loading}
                                             style={{ background: "#2563eb", color: "white", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer" }}
                                         >
                                             Hire
                                         </button>
                                     </div>
                                 ))
                             )}
                         </div>
                     )}
                  </div>
                )}

                {/* B. APPROVE WORK (If Hired & Completed) */}
                {job.status === 2 && (
                  <button 
                    onClick={() => approveWork(job.id)} 
                    disabled={loading}
                    style={{ background: "#22c55e", color: "white", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", marginRight: "10px" }}
                  >
                    ✅ Approve & Pay
                  </button>
                )}

                {/* C. RAISE DISPUTE (If In Progress or Completed) */}
                {(job.status === 1 || job.status === 2) && (
                  <button 
                    onClick={() => raiseDispute(job.id)} 
                    disabled={loading}
                    style={{ background: "#ef4444", color: "white", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }}
                  >
                    🚨 Raise Dispute
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;



