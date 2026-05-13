// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract FreelanceMarketplace {
    enum Role { Arbiter, Client, Freelancer }
    enum JobStatus { Open, InProgress, Completed, Closed, Disputed, Resolved }

    struct User {
        string name;
        Role role;
        uint256 reputation;
        address payable wallet;
        bool registered;
    }

    struct Job {
        uint256 id;
        address client;
        string title;
        string category;
        uint256 budget;
        uint256 deadline;
        JobStatus status;
        address hiredFreelancer;
        uint256 acceptedBidAmount;
        bool freelancerMarkedDone;
        bool clientApproved;
        bool disputed;
    }

    struct Bid {
        address freelancer;
        uint256 amount;
        uint256 proposedTime;
        bool exists;
    }

    address public immutable arbiter;
    uint256 public jobCounter;

    mapping(address => User) public users;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Bid[]) private jobBids; // made private; use getters below
    mapping(uint256 => uint256) public escrow;

    uint256 public totalEscrowLocked;

    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "Reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    event UserRegistered(address indexed user, string name, Role role);
    event JobPosted(uint256 indexed jobId, address indexed client, string title, uint256 budgetWei);
    event BidPlaced(uint256 indexed jobId, address indexed freelancer, uint256 amountWei);
    event FreelancerHired(uint256 indexed jobId, address indexed freelancer, uint256 amountWei);
    event WorkMarkedCompleted(uint256 indexed jobId);
    event WorkApproved(uint256 indexed jobId, uint256 paidToFreelancerWei, uint256 feeWei);
    event DisputeRaised(uint256 indexed jobId);
    event DisputeResolved(uint256 indexed jobId, bool freelancerPaid, uint256 feeWei);
    event FeesWithdrawn(address indexed to, uint256 amountWei);

    constructor() {
        arbiter = msg.sender;
    }

    modifier onlyClient() {
        require(users[msg.sender].registered, "Not registered");
        require(users[msg.sender].role == Role.Client, "Only client");
        _;
    }

    modifier onlyFreelancer() {
        require(users[msg.sender].registered, "Not registered");
        require(users[msg.sender].role == Role.Freelancer, "Only freelancer");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter");
        require(users[msg.sender].registered && users[msg.sender].role == Role.Arbiter, "Arbiter not registered");
        _;
    }

    // -----------------------
    // Fee helpers
    // -----------------------
    function _feePercent(uint256 amountWei) internal pure returns (uint256) {
        return (amountWei < 1 ether) ? 2 : 1;
    }

    function _calculateFee(uint256 amountWei) internal pure returns (uint256) {
        return (amountWei * _feePercent(amountWei)) / 100;
    }

    // -----------------------
    // UI-friendly getters (NEW)
    // -----------------------
    function getBidCount(uint256 jobId) external view returns (uint256) {
        return jobBids[jobId].length;
    }

    function getBid(uint256 jobId, uint256 index) external view returns (Bid memory) {
        require(index < jobBids[jobId].length, "Bad index");
        return jobBids[jobId][index];
    }

    // Fees available to withdraw (contract balance minus locked escrow)
    function availableFees() external view returns (uint256) {
        return address(this).balance - totalEscrowLocked;
    }

    // -----------------------
    // Core functions
    // -----------------------
    function registerUser(string memory _name, Role _role) external {
        require(!users[msg.sender].registered, "User already registered");

        if (_role == Role.Arbiter) {
            require(msg.sender == arbiter, "Only deployer can be Arbiter");
        } else {
            require(_role == Role.Client || _role == Role.Freelancer, "Invalid role");
        }

        uint256 rep = 0;
        if (_role == Role.Freelancer) rep = 100;

        users[msg.sender] = User(_name, _role, rep, payable(msg.sender), true);
        emit UserRegistered(msg.sender, _name, _role);
    }

    function postJob(
        string memory _title,
        string memory _category,
        uint256 _budgetWei,
        uint256 _deadline
    ) external onlyClient {
        require(_budgetWei > 0, "Budget must be > 0");
        require(_deadline > block.timestamp, "Deadline must be future");

        jobCounter += 1;
        uint256 jobId = jobCounter;

        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            title: _title,
            category: _category,
            budget: _budgetWei,
            deadline: _deadline,
            status: JobStatus.Open,
            hiredFreelancer: address(0),
            acceptedBidAmount: 0,
            freelancerMarkedDone: false,
            clientApproved: false,
            disputed: false
        });

        emit JobPosted(jobId, msg.sender, _title, _budgetWei);
    }

    function placeBid(uint256 _jobId, uint256 _amountWei, uint256 _proposedTime) external onlyFreelancer {
        Job storage j = jobs[_jobId];
        require(j.id != 0, "Job does not exist");
        require(j.status == JobStatus.Open, "Job not open");
        require(_amountWei > 0, "Bid must be > 0");
        require(_amountWei <= j.budget, "Bid exceeds budget");
        require(users[msg.sender].reputation >= 50, "Reputation too low");

        jobBids[_jobId].push(Bid({
            freelancer: msg.sender,
            amount: _amountWei,
            proposedTime: _proposedTime,
            exists: true
        }));

        emit BidPlaced(_jobId, msg.sender, _amountWei);
    }

    function hireFreelancer(uint256 _jobId, uint256 _bidIndex) external payable onlyClient nonReentrant {
        Job storage j = jobs[_jobId];
        require(j.id != 0, "Job does not exist");
        require(j.client == msg.sender, "Not your job");
        require(j.status == JobStatus.Open, "Job not open");
        require(_bidIndex < jobBids[_jobId].length, "Invalid bid index");

        Bid memory chosen = jobBids[_jobId][_bidIndex];
        require(chosen.exists, "Bid not found");
        require(msg.value == chosen.amount, "Ether must match bid");

        escrow[_jobId] = msg.value;
        totalEscrowLocked += msg.value;

        j.hiredFreelancer = chosen.freelancer;
        j.acceptedBidAmount = chosen.amount;
        j.status = JobStatus.InProgress;

        emit FreelancerHired(_jobId, chosen.freelancer, chosen.amount);
    }

    function markCompleted(uint256 _jobId) external onlyFreelancer {
        Job storage j = jobs[_jobId];
        require(j.id != 0, "Job does not exist");
        require(j.status == JobStatus.InProgress, "Job not in progress");
        require(j.hiredFreelancer == msg.sender, "Not hired");

        j.freelancerMarkedDone = true;
        j.status = JobStatus.Completed;

        emit WorkMarkedCompleted(_jobId);
    }

    function approveWork(uint256 _jobId) external onlyClient nonReentrant {
        Job storage j = jobs[_jobId];
        require(j.id != 0, "Job does not exist");
        require(j.client == msg.sender, "Not your job");
        require(j.status == JobStatus.Completed, "Job not completed");
        require(!j.disputed, "Job disputed");
        require(j.freelancerMarkedDone, "Freelancer not marked done");

        uint256 amount = j.acceptedBidAmount;
        require(escrow[_jobId] == amount, "Escrow not found");

        uint256 fee = _calculateFee(amount);
        uint256 payToFreelancer = amount - fee;

        j.clientApproved = true;
        j.status = JobStatus.Closed;

        escrow[_jobId] = 0;
        totalEscrowLocked -= amount;

        address payable freelancerWallet = users[j.hiredFreelancer].wallet;
        (bool sent, ) = freelancerWallet.call{value: payToFreelancer}("");
        require(sent, "Payment to freelancer failed");

        users[j.hiredFreelancer].reputation += 10;

        emit WorkApproved(_jobId, payToFreelancer, fee);
    }

    function withdrawFees(address payable to, uint256 amountWei) external onlyArbiter nonReentrant {
        uint256 fees = address(this).balance - totalEscrowLocked;
        require(amountWei <= fees, "Amount exceeds fees");

        (bool ok, ) = to.call{value: amountWei}("");
        require(ok, "Withdraw failed");

        emit FeesWithdrawn(to, amountWei);
    }

    function raiseDispute(uint256 _jobId) external onlyClient {
        Job storage j = jobs[_jobId];
        require(j.id != 0, "Job does not exist");
        require(j.client == msg.sender, "Not your job");
        require(j.status == JobStatus.InProgress || j.status == JobStatus.Completed, "Cannot dispute now");
        require(!j.disputed, "Already disputed");

        j.disputed = true;
        j.status = JobStatus.Disputed;

        emit DisputeRaised(_jobId);
    }

    function resolveDispute(uint256 _jobId, bool _payFreelancer) external onlyArbiter nonReentrant {
        Job storage j = jobs[_jobId];
        require(j.id != 0, "Job does not exist");
        require(j.status == JobStatus.Disputed, "Job not disputed");

        uint256 amount = j.acceptedBidAmount;
        require(escrow[_jobId] == amount, "Escrow not found");

        address payable clientWallet = payable(j.client);
        address hired = j.hiredFreelancer;
        address payable freelancerWallet = users[hired].wallet;

        uint256 fee = 0;

        j.status = JobStatus.Resolved;
        escrow[_jobId] = 0;
        totalEscrowLocked -= amount;

        if (_payFreelancer) {
            fee = _calculateFee(amount);
            uint256 payToFreelancer = amount - fee;

            (bool sent, ) = freelancerWallet.call{value: payToFreelancer}("");
            require(sent, "Payment to freelancer failed");

            emit DisputeResolved(_jobId, true, fee);
        } else {
            (bool refunded, ) = clientWallet.call{value: amount}("");
            require(refunded, "Refund failed");

            uint256 rep = users[hired].reputation;
            users[hired].reputation = (rep >= 20) ? (rep - 20) : 0;

            emit DisputeResolved(_jobId, false, 0);
        }
    }
}


