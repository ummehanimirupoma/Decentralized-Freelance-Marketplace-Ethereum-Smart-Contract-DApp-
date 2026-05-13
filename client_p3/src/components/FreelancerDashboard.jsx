import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function FreelancerDashboard({ contract, account }) {
  const [jobs, setJobs] = useState([]);          // Marketplace Jobs (Open)
  const [myJobs, setMyJobs] = useState([]);      // Jobs I am hired for
  const [filter, setFilter] = useState("All");
  const [reputation, setReputation] = useState(0);

  const loadData = async () => {
    if (!contract || !account) return;

    try {
      // 1. Fetch Reputation
      const user = await contract.users(account);
      setReputation(Number(user.reputation));

      // 2. Fetch Jobs
      const count = await contract.jobCounter();
      let openJobs = [];
      let hiredJobs = [];

      for (let i = 1; i <= Number(count); i++) {
        const job = await contract.jobs(i);
        const status = Number(job.status);
        
        // FORMAT JOB DATA
        const formattedJob = {
          id: i,
          title: job.title,
          category: job.category,
          budget: ethers.formatEther(job.budget),
          status: status,
          hiredFreelancer: job.hiredFreelancer,
          deadline: new Date(Number(job.deadline) * 1000).toLocaleDateString(),
          rawdeadline: Number(job.deadline),
        };

        // LIST 1: Marketplace (Open Jobs Only)
        if (status === 0) {
          openJobs.push(formattedJob);
        }

        // LIST 2: My Active Jobs (Hired & Not Closed)
        // Check if I am the freelancer AND the job is In Progress (1) or Completed (2)
        if (job.hiredFreelancer.toLowerCase() === account.toLowerCase()) {
           if (status === 1 || status === 2) {
             hiredJobs.push(formattedJob);
           }
        }
      }

      setJobs(openJobs);
      setMyJobs(hiredJobs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadData(); }, [contract, account]);

  const placeBid = async (jobId, budgetEth, rawdeadline) => {
    const amount = prompt(`Enter Bid Amount (Max ${budgetEth} ETH):`);
    if (!amount) return;

    const days = prompt("Enter Days to complete:");
    if (!days) return;
    const timeInSeconds = Number(days) * 24 * 60 * 60;

    try {
      const tx = await contract.placeBid(jobId, ethers.parseEther(amount), timeInSeconds);
      await tx.wait();
      alert("Bid Placed Successfully!");
      loadData(); // Refresh
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const markDone = async (jobId) => {
    try {
      const tx = await contract.markCompleted(jobId);
      await tx.wait();
      alert("Job marked as Completed! Waiting for client approval.");
      loadData(); // Refresh
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const getStatusLabel = (s) => ["Open", "In Progress", "Completed (Waiting for Payment)", "Closed", "Disputed", "Resolved"][s];

  // Filter and Sort Open Jobs
  const displayOpenJobs = jobs
    .filter(j => filter === "All" || j.category === filter)
    .sort((a, b) => parseFloat(b.budget) - parseFloat(a.budget));

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom:"20px" }}>
        <h3>Freelancer Dashboard</h3>
        <div style={{ background: "#eee", padding: "8px 15px", borderRadius: "20px" }}>
          <strong>⭐ Reputation: {reputation}</strong>
        </div>
      </div>

      {/* SECTION 1: MY ACTIVE JOBS */}
      <div style={{ marginBottom: "40px", padding: "20px", backgroundColor: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
        <h3 style={{ marginTop: 0, color: "#0284c7" }}>📂 Jobs I'm Hired For</h3>
        {myJobs.length === 0 ? <p>You have no active jobs.</p> : (
          <div>
            {myJobs.map(job => (
              <div key={job.id} style={{ background: "white", padding: "15px", margin: "10px 0", borderRadius: "8px", border: "1px solid #e0f2fe" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h4>#{job.id} {job.title}</h4>
                  <span style={{ fontWeight: "bold", color: job.status === 2 ? "orange" : "blue" }}>
                    {getStatusLabel(job.status)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "20px", margin: "10px 0", color: "#555" }}> <span>💰 <strong>Budget:</strong> {job.budget} ETH</span> <span>📅 <strong>Deadline:</strong> {job.deadline}</span> 
                </div>
                <p><strong>Budget:</strong> {job.budget} ETH</p>
                
                {/* ACTION BUTTON */}
                {job.status === 1 && (
                  <button 
                    onClick={() => markDone(job.id)}
                    style={{ background: "#28a745", color: "white", padding: "10px 15px", border: "none", borderRadius: "5px", cursor: "pointer" }}
                  >
                    ✅ Mark Work as Completed
                  </button>
                )}
                {job.status === 2 && (
                   <p style={{ fontStyle: "italic", color: "#666" }}>Waiting for Client to approve and pay...</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <hr style={{ margin: "30px 0", borderTop: "1px solid #ddd" }} />

      {/* SECTION 2: FIND WORK */}
      <h3>🔍 Find New Work</h3>
      <select onChange={(e) => setFilter(e.target.value)} style={{ padding: "8px", marginBottom: "15px" }}>
        <option value="All">All Categories</option>
        <option value="Dev">Dev</option>
        <option value="Design">Design</option>
        <option value="Marketing">Marketing</option>
      </select>

      {displayOpenJobs.length === 0 ? <p>No open jobs found.</p> : (
        <div>
          {displayOpenJobs.map(job => (
            <div key={job.id} style={{ border: "1px solid #ddd", padding: "15px", margin: "10px 0", borderRadius: "8px" }}>
              <h4>#{job.id} {job.title} <span style={{ float: "right", color: "green" }}>{job.budget} ETH</span></h4>
              <p>Category: {job.category}</p>
              <p style={{ margin: "5px 0", color: "#d32f2f" }}>📅 <strong>Deadline: {job.deadline}</strong></p> 
              <button 
                onClick={() => placeBid(job.id, job.budget)}
                style={{ background: "#007bff", color: "white", padding: "8px 12px", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                Place Bid
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


