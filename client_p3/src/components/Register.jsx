import { useState } from "react";

const Register = ({ contract, onSuccess }) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("1"); // Default to Client (1)
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name) return alert("Please enter your name");

    try {
      setLoading(true);
      // Role Enum: 0 = Arbiter, 1 = Client, 2 = Freelancer
      const tx = await contract.registerUser(name, parseInt(role));
      await tx.wait();
      alert("Registration Successful!");
      onSuccess(); // Reloads the app to show the dashboard
    } catch (error) {
      console.error(error);
      alert("Registration Failed: " + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2>📝 Create Account</h2>
      <p>Please register to access the platform.</p>
      
      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "15px", maxWidth: "300px", margin: "0 auto" }}>
        <input 
          type="text" 
          placeholder="Display Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
        />

        <select 
          value={role} 
          onChange={(e) => setRole(e.target.value)}
          style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
        >
          <option value="1">Client (I want to hire)</option>
          <option value="2">Freelancer (I want to work)</option>
          <option value="0">Arbiter (Admin Only)</option>
        </select>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: "10px", 
            background: "#4f46e5", 
            color: "white", 
            border: "none", 
            borderRadius: "5px", 
            cursor: "pointer" 
          }}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
      
      <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "10px" }}>
        *Only the contract deployer can register as Arbiter.
      </p>
    </div>
  );
};

export default Register;



