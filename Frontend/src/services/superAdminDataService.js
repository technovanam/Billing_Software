// Super Admin Central Data & State Service

const STORAGE_KEYS = {
  BUSINESSES: "sa_businesses",
  PLANS: "sa_plans",
  SUBSCRIPTIONS: "sa_subscriptions",
  PAYMENTS: "sa_payments",
  USERS: "sa_users",
  BRANCHES: "sa_branches",
  GODOWNS: "sa_godowns",
  TERMINALS: "sa_terminals",
  COUPONS: "sa_coupons",
  TICKETS: "sa_tickets",
  ANNOUNCEMENTS: "sa_announcements",
  ADMIN_USERS: "sa_admin_users",
  ROLES: "sa_roles",
  INVOICES: "sa_invoices",
  AUDIT_LOGS: "sa_audit_logs",
  LOGIN_ACTIVITY: "sa_login_activity",
  SESSIONS: "sa_sessions",
  SETTINGS: "sa_settings",
  BACKUPS: "sa_backups",
  MAINTENANCE: "sa_maintenance",
};

// Initial Seed Data
const INITIAL_PLANS = [
  {
    "id": "plan_1",
    "name": "Free Trial",
    "price": 999,
    "billingCycle": "Monthly",
    "status": "Inactive",
    "features": [
      "Invoicing",
      "Inventory",
      "CRM"
    ],
    "subscribers": 443
  },
  {
    "id": "plan_2",
    "name": "Starter",
    "price": 1999,
    "billingCycle": "Annually",
    "status": "Active",
    "features": [
      "Invoicing",
      "Inventory",
      "CRM"
    ],
    "subscribers": 131
  },
  {
    "id": "plan_3",
    "name": "Professional",
    "price": 2999,
    "billingCycle": "Monthly",
    "status": "Active",
    "features": [
      "Invoicing",
      "Inventory",
      "CRM"
    ],
    "subscribers": 212
  },
  {
    "id": "plan_4",
    "name": "Business",
    "price": 3999,
    "billingCycle": "Annually",
    "status": "Active",
    "features": [
      "Invoicing",
      "Inventory",
      "CRM"
    ],
    "subscribers": 131
  },
  {
    "id": "plan_5",
    "name": "Enterprise",
    "price": 4999,
    "billingCycle": "Monthly",
    "status": "Active",
    "features": [
      "Invoicing",
      "Inventory",
      "CRM"
    ],
    "subscribers": 427
  },
];
const INITIAL_BUSINESSES = [
  {
    "id": "bus_1000",
    "name": "Business Name 1",
    "ownerName": "Owner 1",
    "ownerEmail": "owner1@example.com",
    "phone": "+91 9876543210",
    "city": "Mumbai",
    "planName": "Free Trial",
    "branchesCount": 1,
    "usersCount": 2,
    "status": "Active",
    "subscriptionExpiry": "2026-09-23",
    "totalSales": 15000,
    "gstin": "27AAAAA0000A1Z0"
  },
  {
    "id": "bus_1001",
    "name": "Business Name 2",
    "ownerName": "Owner 2",
    "ownerEmail": "owner2@example.com",
    "phone": "+91 9876543211",
    "city": "Delhi",
    "planName": "Starter",
    "branchesCount": 2,
    "usersCount": 3,
    "status": "Trial",
    "subscriptionExpiry": "2026-09-28",
    "totalSales": 30000,
    "gstin": "27AAAAA0000A1Z1"
  },
  {
    "id": "bus_1002",
    "name": "Business Name 3",
    "ownerName": "Owner 3",
    "ownerEmail": "owner3@example.com",
    "phone": "+91 9876543212",
    "city": "Bangalore",
    "planName": "Professional",
    "branchesCount": 3,
    "usersCount": 4,
    "status": "Suspended",
    "subscriptionExpiry": "2026-10-03",
    "totalSales": 45000,
    "gstin": "27AAAAA0000A1Z2"
  },
  {
    "id": "bus_1003",
    "name": "Business Name 4",
    "ownerName": "Owner 4",
    "ownerEmail": "owner4@example.com",
    "phone": "+91 9876543213",
    "city": "Hyderabad",
    "planName": "Business",
    "branchesCount": 4,
    "usersCount": 5,
    "status": "Expired",
    "subscriptionExpiry": "2026-10-08",
    "totalSales": 60000,
    "gstin": "27AAAAA0000A1Z3"
  },
  {
    "id": "bus_1004",
    "name": "Business Name 5",
    "ownerName": "Owner 5",
    "ownerEmail": "owner5@example.com",
    "phone": "+91 9876543214",
    "city": "Chennai",
    "planName": "Enterprise",
    "branchesCount": 5,
    "usersCount": 6,
    "status": "Active",
    "subscriptionExpiry": "2026-10-13",
    "totalSales": 75000,
    "gstin": "27AAAAA0000A1Z4"
  },
  {
    "id": "bus_1005",
    "name": "Business Name 6",
    "ownerName": "Owner 6",
    "ownerEmail": "owner6@example.com",
    "phone": "+91 9876543215",
    "city": "Mumbai",
    "planName": "Free Trial",
    "branchesCount": 1,
    "usersCount": 7,
    "status": "Trial",
    "subscriptionExpiry": "2026-10-18",
    "totalSales": 90000,
    "gstin": "27AAAAA0000A1Z5"
  },
  {
    "id": "bus_1006",
    "name": "Business Name 7",
    "ownerName": "Owner 7",
    "ownerEmail": "owner7@example.com",
    "phone": "+91 9876543216",
    "city": "Delhi",
    "planName": "Starter",
    "branchesCount": 2,
    "usersCount": 8,
    "status": "Suspended",
    "subscriptionExpiry": "2026-10-23",
    "totalSales": 105000,
    "gstin": "27AAAAA0000A1Z6"
  },
  {
    "id": "bus_1007",
    "name": "Business Name 8",
    "ownerName": "Owner 8",
    "ownerEmail": "owner8@example.com",
    "phone": "+91 9876543217",
    "city": "Bangalore",
    "planName": "Professional",
    "branchesCount": 3,
    "usersCount": 9,
    "status": "Expired",
    "subscriptionExpiry": "2026-10-28",
    "totalSales": 120000,
    "gstin": "27AAAAA0000A1Z7"
  },
  {
    "id": "bus_1008",
    "name": "Business Name 9",
    "ownerName": "Owner 9",
    "ownerEmail": "owner9@example.com",
    "phone": "+91 9876543218",
    "city": "Hyderabad",
    "planName": "Business",
    "branchesCount": 4,
    "usersCount": 10,
    "status": "Active",
    "subscriptionExpiry": "2026-11-02",
    "totalSales": 135000,
    "gstin": "27AAAAA0000A1Z8"
  },
  {
    "id": "bus_1009",
    "name": "Business Name 10",
    "ownerName": "Owner 10",
    "ownerEmail": "owner10@example.com",
    "phone": "+91 9876543219",
    "city": "Chennai",
    "planName": "Enterprise",
    "branchesCount": 5,
    "usersCount": 11,
    "status": "Trial",
    "subscriptionExpiry": "2026-11-07",
    "totalSales": 150000,
    "gstin": "27AAAAA0000A1Z9"
  },
  {
    "id": "bus_1010",
    "name": "Business Name 11",
    "ownerName": "Owner 11",
    "ownerEmail": "owner11@example.com",
    "phone": "+91 9876543220",
    "city": "Mumbai",
    "planName": "Free Trial",
    "branchesCount": 1,
    "usersCount": 2,
    "status": "Suspended",
    "subscriptionExpiry": "2026-11-12",
    "totalSales": 165000,
    "gstin": "27AAAAA0000A1Z10"
  },
  {
    "id": "bus_1011",
    "name": "Business Name 12",
    "ownerName": "Owner 12",
    "ownerEmail": "owner12@example.com",
    "phone": "+91 9876543221",
    "city": "Delhi",
    "planName": "Starter",
    "branchesCount": 2,
    "usersCount": 3,
    "status": "Expired",
    "subscriptionExpiry": "2026-11-17",
    "totalSales": 180000,
    "gstin": "27AAAAA0000A1Z11"
  },
  {
    "id": "bus_1012",
    "name": "Business Name 13",
    "ownerName": "Owner 13",
    "ownerEmail": "owner13@example.com",
    "phone": "+91 9876543222",
    "city": "Bangalore",
    "planName": "Professional",
    "branchesCount": 3,
    "usersCount": 4,
    "status": "Active",
    "subscriptionExpiry": "2026-11-22",
    "totalSales": 195000,
    "gstin": "27AAAAA0000A1Z12"
  },
  {
    "id": "bus_1013",
    "name": "Business Name 14",
    "ownerName": "Owner 14",
    "ownerEmail": "owner14@example.com",
    "phone": "+91 9876543223",
    "city": "Hyderabad",
    "planName": "Business",
    "branchesCount": 4,
    "usersCount": 5,
    "status": "Trial",
    "subscriptionExpiry": "2026-11-27",
    "totalSales": 210000,
    "gstin": "27AAAAA0000A1Z13"
  },
  {
    "id": "bus_1014",
    "name": "Business Name 15",
    "ownerName": "Owner 15",
    "ownerEmail": "owner15@example.com",
    "phone": "+91 9876543224",
    "city": "Chennai",
    "planName": "Enterprise",
    "branchesCount": 5,
    "usersCount": 6,
    "status": "Suspended",
    "subscriptionExpiry": "2026-12-02",
    "totalSales": 225000,
    "gstin": "27AAAAA0000A1Z14"
  }
];
const INITIAL_USERS = [
  {
    "id": "usr_2000",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "name": "User 1",
    "email": "user1@example.com",
    "role": "Admin",
    "status": "Suspended",
    "lastLogin": "2026-09-23 06:23:47"
  },
  {
    "id": "usr_2001",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "name": "User 2",
    "email": "user2@example.com",
    "role": "Manager",
    "status": "Active",
    "lastLogin": "2026-09-23 05:23:47"
  },
  {
    "id": "usr_2002",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "name": "User 3",
    "email": "user3@example.com",
    "role": "Cashier",
    "status": "Active",
    "lastLogin": "2026-09-23 04:23:47"
  },
  {
    "id": "usr_2003",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "name": "User 4",
    "email": "user4@example.com",
    "role": "Staff",
    "status": "Active",
    "lastLogin": "2026-09-23 03:23:47"
  },
  {
    "id": "usr_2004",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "name": "User 5",
    "email": "user5@example.com",
    "role": "Admin",
    "status": "Active",
    "lastLogin": "2026-09-23 02:23:47"
  },
  {
    "id": "usr_2005",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "name": "User 6",
    "email": "user6@example.com",
    "role": "Manager",
    "status": "Active",
    "lastLogin": "2026-09-23 01:23:47"
  },
  {
    "id": "usr_2006",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "name": "User 7",
    "email": "user7@example.com",
    "role": "Cashier",
    "status": "Active",
    "lastLogin": "2026-09-23 00:23:47"
  },
  {
    "id": "usr_2007",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "name": "User 8",
    "email": "user8@example.com",
    "role": "Staff",
    "status": "Active",
    "lastLogin": "2026-09-22 23:23:47"
  },
  {
    "id": "usr_2008",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "name": "User 9",
    "email": "user9@example.com",
    "role": "Admin",
    "status": "Suspended",
    "lastLogin": "2026-09-22 22:23:47"
  },
  {
    "id": "usr_2009",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "name": "User 10",
    "email": "user10@example.com",
    "role": "Manager",
    "status": "Active",
    "lastLogin": "2026-09-22 21:23:47"
  },
  {
    "id": "usr_2010",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "name": "User 11",
    "email": "user11@example.com",
    "role": "Cashier",
    "status": "Active",
    "lastLogin": "2026-09-22 20:23:47"
  },
  {
    "id": "usr_2011",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "name": "User 12",
    "email": "user12@example.com",
    "role": "Staff",
    "status": "Active",
    "lastLogin": "2026-09-22 19:23:47"
  }
];
const INITIAL_BRANCHES = [
  {
    "id": "br_3000",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "name": "Branch 1",
    "city": "Mumbai",
    "status": "Active",
    "manager": "Manager 1"
  },
  {
    "id": "br_3001",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "name": "Branch 2",
    "city": "Delhi",
    "status": "Active",
    "manager": "Manager 2"
  },
  {
    "id": "br_3002",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "name": "Branch 3",
    "city": "Bangalore",
    "status": "Active",
    "manager": "Manager 3"
  },
  {
    "id": "br_3003",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "name": "Branch 4",
    "city": "Hyderabad",
    "status": "Active",
    "manager": "Manager 4"
  },
  {
    "id": "br_3004",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "name": "Branch 5",
    "city": "Chennai",
    "status": "Active",
    "manager": "Manager 5"
  },
  {
    "id": "br_3005",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "name": "Branch 6",
    "city": "Mumbai",
    "status": "Active",
    "manager": "Manager 6"
  },
  {
    "id": "br_3006",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "name": "Branch 7",
    "city": "Delhi",
    "status": "Active",
    "manager": "Manager 7"
  },
  {
    "id": "br_3007",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "name": "Branch 8",
    "city": "Bangalore",
    "status": "Active",
    "manager": "Manager 8"
  },
  {
    "id": "br_3008",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "name": "Branch 9",
    "city": "Hyderabad",
    "status": "Active",
    "manager": "Manager 9"
  },
  {
    "id": "br_3009",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "name": "Branch 10",
    "city": "Chennai",
    "status": "Active",
    "manager": "Manager 10"
  }
];
const INITIAL_GODOWNS = [
  {
    "id": "gd_4000",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "name": "Godown 1",
    "location": "North Zone",
    "status": "Active",
    "capacity": 1000
  },
  {
    "id": "gd_4001",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "name": "Godown 2",
    "location": "South Zone",
    "status": "Active",
    "capacity": 2000
  },
  {
    "id": "gd_4002",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "name": "Godown 3",
    "location": "East Zone",
    "status": "Active",
    "capacity": 3000
  },
  {
    "id": "gd_4003",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "name": "Godown 4",
    "location": "West Zone",
    "status": "Active",
    "capacity": 4000
  },
  {
    "id": "gd_4004",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "name": "Godown 5",
    "location": "North Zone",
    "status": "Active",
    "capacity": 5000
  },
  {
    "id": "gd_4005",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "name": "Godown 6",
    "location": "South Zone",
    "status": "Active",
    "capacity": 6000
  },
  {
    "id": "gd_4006",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "name": "Godown 7",
    "location": "East Zone",
    "status": "Active",
    "capacity": 7000
  },
  {
    "id": "gd_4007",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "name": "Godown 8",
    "location": "West Zone",
    "status": "Active",
    "capacity": 8000
  },
  {
    "id": "gd_4008",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "name": "Godown 9",
    "location": "North Zone",
    "status": "Active",
    "capacity": 9000
  },
  {
    "id": "gd_4009",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "name": "Godown 10",
    "location": "South Zone",
    "status": "Active",
    "capacity": 10000
  }
];
const INITIAL_TERMINALS = [
  {
    "id": "term_5000",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "branchName": "Branch 1",
    "name": "POS Terminal 1",
    "status": "Offline",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5001",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "branchName": "Branch 2",
    "name": "POS Terminal 2",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5002",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "branchName": "Branch 3",
    "name": "POS Terminal 3",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5003",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "branchName": "Branch 4",
    "name": "POS Terminal 4",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5004",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "branchName": "Branch 5",
    "name": "POS Terminal 5",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5005",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "branchName": "Branch 6",
    "name": "POS Terminal 6",
    "status": "Offline",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5006",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "branchName": "Branch 7",
    "name": "POS Terminal 7",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5007",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "branchName": "Branch 8",
    "name": "POS Terminal 8",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5008",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "branchName": "Branch 9",
    "name": "POS Terminal 9",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  },
  {
    "id": "term_5009",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "branchName": "Branch 10",
    "name": "POS Terminal 10",
    "status": "Online",
    "lastSync": "2026-09-23T06:23:47.222Z"
  }
];
const INITIAL_PAYMENTS = [
  {
    "id": "pay_6000",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "amount": 500,
    "currency": "INR",
    "status": "Completed",
    "date": "2026-09-23",
    "method": "Credit Card"
  },
  {
    "id": "pay_6001",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "amount": 1000,
    "currency": "INR",
    "status": "Pending",
    "date": "2026-09-22",
    "method": "UPI"
  },
  {
    "id": "pay_6002",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "amount": 1500,
    "currency": "INR",
    "status": "Failed",
    "date": "2026-09-21",
    "method": "Bank Transfer"
  },
  {
    "id": "pay_6003",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "amount": 2000,
    "currency": "INR",
    "status": "Refunded",
    "date": "2026-09-20",
    "method": "Credit Card"
  },
  {
    "id": "pay_6004",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "amount": 2500,
    "currency": "INR",
    "status": "Completed",
    "date": "2026-09-19",
    "method": "UPI"
  },
  {
    "id": "pay_6005",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "amount": 3000,
    "currency": "INR",
    "status": "Pending",
    "date": "2026-09-18",
    "method": "Bank Transfer"
  },
  {
    "id": "pay_6006",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "amount": 3500,
    "currency": "INR",
    "status": "Failed",
    "date": "2026-09-17",
    "method": "Credit Card"
  },
  {
    "id": "pay_6007",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "amount": 4000,
    "currency": "INR",
    "status": "Refunded",
    "date": "2026-09-16",
    "method": "UPI"
  },
  {
    "id": "pay_6008",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "amount": 4500,
    "currency": "INR",
    "status": "Completed",
    "date": "2026-09-15",
    "method": "Bank Transfer"
  },
  {
    "id": "pay_6009",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "amount": 5000,
    "currency": "INR",
    "status": "Pending",
    "date": "2026-09-14",
    "method": "Credit Card"
  },
  {
    "id": "pay_6010",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "amount": 5500,
    "currency": "INR",
    "status": "Failed",
    "date": "2026-09-13",
    "method": "UPI"
  },
  {
    "id": "pay_6011",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "amount": 6000,
    "currency": "INR",
    "status": "Refunded",
    "date": "2026-09-12",
    "method": "Bank Transfer"
  },
  {
    "id": "pay_6012",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "amount": 6500,
    "currency": "INR",
    "status": "Completed",
    "date": "2026-09-11",
    "method": "Credit Card"
  },
  {
    "id": "pay_6013",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "amount": 7000,
    "currency": "INR",
    "status": "Pending",
    "date": "2026-09-10",
    "method": "UPI"
  },
  {
    "id": "pay_6014",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "amount": 7500,
    "currency": "INR",
    "status": "Failed",
    "date": "2026-09-09",
    "method": "Bank Transfer"
  }
];
const INITIAL_COUPONS = [
  {
    "id": "coup_7000",
    "code": "DISCOUNT0",
    "discountType": "Percentage",
    "discountValue": 5,
    "status": "Expired",
    "usedCount": 0,
    "expiryDate": "2026-09-23"
  },
  {
    "id": "coup_7001",
    "code": "DISCOUNT10",
    "discountType": "Flat",
    "discountValue": 10,
    "status": "Active",
    "usedCount": 3,
    "expiryDate": "2026-10-03"
  },
  {
    "id": "coup_7002",
    "code": "DISCOUNT20",
    "discountType": "Percentage",
    "discountValue": 15,
    "status": "Active",
    "usedCount": 6,
    "expiryDate": "2026-10-13"
  },
  {
    "id": "coup_7003",
    "code": "DISCOUNT30",
    "discountType": "Flat",
    "discountValue": 20,
    "status": "Active",
    "usedCount": 9,
    "expiryDate": "2026-10-23"
  },
  {
    "id": "coup_7004",
    "code": "DISCOUNT40",
    "discountType": "Percentage",
    "discountValue": 25,
    "status": "Expired",
    "usedCount": 12,
    "expiryDate": "2026-11-02"
  },
  {
    "id": "coup_7005",
    "code": "DISCOUNT50",
    "discountType": "Flat",
    "discountValue": 30,
    "status": "Active",
    "usedCount": 15,
    "expiryDate": "2026-11-12"
  },
  {
    "id": "coup_7006",
    "code": "DISCOUNT60",
    "discountType": "Percentage",
    "discountValue": 35,
    "status": "Active",
    "usedCount": 18,
    "expiryDate": "2026-11-22"
  },
  {
    "id": "coup_7007",
    "code": "DISCOUNT70",
    "discountType": "Flat",
    "discountValue": 40,
    "status": "Active",
    "usedCount": 21,
    "expiryDate": "2026-12-02"
  },
  {
    "id": "coup_7008",
    "code": "DISCOUNT80",
    "discountType": "Percentage",
    "discountValue": 45,
    "status": "Expired",
    "usedCount": 24,
    "expiryDate": "2026-12-12"
  },
  {
    "id": "coup_7009",
    "code": "DISCOUNT90",
    "discountType": "Flat",
    "discountValue": 50,
    "status": "Active",
    "usedCount": 27,
    "expiryDate": "2026-12-22"
  }
];
const INITIAL_TICKETS = [
  {
    "id": "tkt_8000",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "subject": "Issue with feature 1",
    "status": "Open",
    "priority": "Low",
    "createdAt": "2026-09-23",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8001",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "subject": "Issue with feature 2",
    "status": "In Progress",
    "priority": "Medium",
    "createdAt": "2026-09-22",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8002",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "subject": "Issue with feature 3",
    "status": "Resolved",
    "priority": "High",
    "createdAt": "2026-09-21",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8003",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "subject": "Issue with feature 4",
    "status": "Closed",
    "priority": "Urgent",
    "createdAt": "2026-09-20",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8004",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "subject": "Issue with feature 5",
    "status": "Open",
    "priority": "Low",
    "createdAt": "2026-09-19",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8005",
    "businessId": "bus_1000",
    "businessName": "Business Name 1",
    "subject": "Issue with feature 6",
    "status": "In Progress",
    "priority": "Medium",
    "createdAt": "2026-09-18",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8006",
    "businessId": "bus_1001",
    "businessName": "Business Name 2",
    "subject": "Issue with feature 7",
    "status": "Resolved",
    "priority": "High",
    "createdAt": "2026-09-17",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8007",
    "businessId": "bus_1002",
    "businessName": "Business Name 3",
    "subject": "Issue with feature 8",
    "status": "Closed",
    "priority": "Urgent",
    "createdAt": "2026-09-16",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8008",
    "businessId": "bus_1003",
    "businessName": "Business Name 4",
    "subject": "Issue with feature 9",
    "status": "Open",
    "priority": "Low",
    "createdAt": "2026-09-15",
    "updatedAt": "Just now",
    "conversation": []
  },
  {
    "id": "tkt_8009",
    "businessId": "bus_1004",
    "businessName": "Business Name 5",
    "subject": "Issue with feature 10",
    "status": "In Progress",
    "priority": "Medium",
    "createdAt": "2026-09-14",
    "updatedAt": "Just now",
    "conversation": []
  }
];
const INITIAL_ANNOUNCEMENTS = [
  {
    "id": "anc_9000",
    "title": "Announcement 1",
    "content": "This is the content for announcement 1",
    "publishedAt": "2026-09-23",
    "active": false,
    "type": "Update"
  },
  {
    "id": "anc_9001",
    "title": "Announcement 2",
    "content": "This is the content for announcement 2",
    "publishedAt": "2026-09-21",
    "active": true,
    "type": "Maintenance"
  },
  {
    "id": "anc_9002",
    "title": "Announcement 3",
    "content": "This is the content for announcement 3",
    "publishedAt": "2026-09-19",
    "active": true,
    "type": "Feature"
  },
  {
    "id": "anc_9003",
    "title": "Announcement 4",
    "content": "This is the content for announcement 4",
    "publishedAt": "2026-09-17",
    "active": true,
    "type": "News"
  },
  {
    "id": "anc_9004",
    "title": "Announcement 5",
    "content": "This is the content for announcement 5",
    "publishedAt": "2026-09-15",
    "active": true,
    "type": "Update"
  },
  {
    "id": "anc_9005",
    "title": "Announcement 6",
    "content": "This is the content for announcement 6",
    "publishedAt": "2026-09-13",
    "active": false,
    "type": "Maintenance"
  },
  {
    "id": "anc_9006",
    "title": "Announcement 7",
    "content": "This is the content for announcement 7",
    "publishedAt": "2026-09-11",
    "active": true,
    "type": "Feature"
  },
  {
    "id": "anc_9007",
    "title": "Announcement 8",
    "content": "This is the content for announcement 8",
    "publishedAt": "2026-09-09",
    "active": true,
    "type": "News"
  },
  {
    "id": "anc_9008",
    "title": "Announcement 9",
    "content": "This is the content for announcement 9",
    "publishedAt": "2026-09-07",
    "active": true,
    "type": "Update"
  },
  {
    "id": "anc_9009",
    "title": "Announcement 10",
    "content": "This is the content for announcement 10",
    "publishedAt": "2026-09-05",
    "active": true,
    "type": "Maintenance"
  }
];
const INITIAL_ADMIN_USERS = [
  {
    "id": "adm_10000",
    "name": "Admin User 1",
    "email": "admin1@technovanam.com",
    "role": "Super Admin",
    "status": "Active",
    "lastLogin": "2026-09-23 06:23:47",
    "createdAt": "2026-09-23"
  },
  {
    "id": "adm_10001",
    "name": "Admin User 2",
    "email": "admin2@technovanam.com",
    "role": "Support Lead",
    "status": "Active",
    "lastLogin": "2026-09-23 05:23:47",
    "createdAt": "2026-08-24"
  },
  {
    "id": "adm_10002",
    "name": "Admin User 3",
    "email": "admin3@technovanam.com",
    "role": "Sales Manager",
    "status": "Active",
    "lastLogin": "2026-09-23 04:23:47",
    "createdAt": "2026-07-25"
  },
  {
    "id": "adm_10003",
    "name": "Admin User 4",
    "email": "admin4@technovanam.com",
    "role": "Billing Admin",
    "status": "Active",
    "lastLogin": "2026-09-23 03:23:47",
    "createdAt": "2026-06-25"
  },
  {
    "id": "adm_10004",
    "name": "Admin User 5",
    "email": "admin5@technovanam.com",
    "role": "Super Admin",
    "status": "Active",
    "lastLogin": "2026-09-23 02:23:47",
    "createdAt": "2026-05-26"
  },
  {
    "id": "adm_10005",
    "name": "Admin User 6",
    "email": "admin6@technovanam.com",
    "role": "Support Lead",
    "status": "Active",
    "lastLogin": "2026-09-23 01:23:47",
    "createdAt": "2026-04-26"
  },
  {
    "id": "adm_10006",
    "name": "Admin User 7",
    "email": "admin7@technovanam.com",
    "role": "Sales Manager",
    "status": "Active",
    "lastLogin": "2026-09-23 00:23:47",
    "createdAt": "2026-03-27"
  },
  {
    "id": "adm_10007",
    "name": "Admin User 8",
    "email": "admin8@technovanam.com",
    "role": "Billing Admin",
    "status": "Active",
    "lastLogin": "2026-09-22 23:23:47",
    "createdAt": "2026-02-25"
  },
  {
    "id": "adm_10008",
    "name": "Admin User 9",
    "email": "admin9@technovanam.com",
    "role": "Super Admin",
    "status": "Active",
    "lastLogin": "2026-09-22 22:23:47",
    "createdAt": "2026-01-26"
  },
  {
    "id": "adm_10009",
    "name": "Admin User 10",
    "email": "admin10@technovanam.com",
    "role": "Support Lead",
    "status": "Active",
    "lastLogin": "2026-09-22 21:23:47",
    "createdAt": "2025-12-27"
  }
];
const INITIAL_AUDIT_LOGS = [
  {
    "id": "aud_11000",
    "timestamp": "2026-09-23 06:23:47",
    "admin": "admin1@technovanam.com",
    "action": "LOGIN",
    "entity": "Auth",
    "entityId": "ent_0",
    "business": "Business Name 1",
    "ip": "192.168.1.0",
    "device": "Desktop - Windows 11",
    "result": "Failed",
    "details": "Performed action 0"
  },
  {
    "id": "aud_11001",
    "timestamp": "2026-09-23 05:23:47",
    "admin": "admin2@technovanam.com",
    "action": "UPDATE_PLAN",
    "entity": "Plan",
    "entityId": "ent_1",
    "business": "Business Name 2",
    "ip": "192.168.1.1",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 1"
  },
  {
    "id": "aud_11002",
    "timestamp": "2026-09-23 04:23:47",
    "admin": "admin3@technovanam.com",
    "action": "SUSPEND_BUSINESS",
    "entity": "Business",
    "entityId": "ent_2",
    "business": "Business Name 3",
    "ip": "192.168.1.2",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 2"
  },
  {
    "id": "aud_11003",
    "timestamp": "2026-09-23 03:23:47",
    "admin": "admin1@technovanam.com",
    "action": "RESOLVE_TICKET",
    "entity": "Ticket",
    "entityId": "ent_3",
    "business": "Business Name 4",
    "ip": "192.168.1.3",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 3"
  },
  {
    "id": "aud_11004",
    "timestamp": "2026-09-23 02:23:47",
    "admin": "admin2@technovanam.com",
    "action": "LOGIN",
    "entity": "Auth",
    "entityId": "ent_4",
    "business": "Business Name 5",
    "ip": "192.168.1.4",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 4"
  },
  {
    "id": "aud_11005",
    "timestamp": "2026-09-23 01:23:47",
    "admin": "admin3@technovanam.com",
    "action": "UPDATE_PLAN",
    "entity": "Plan",
    "entityId": "ent_5",
    "business": "Business Name 1",
    "ip": "192.168.1.5",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 5"
  },
  {
    "id": "aud_11006",
    "timestamp": "2026-09-23 00:23:47",
    "admin": "admin1@technovanam.com",
    "action": "SUSPEND_BUSINESS",
    "entity": "Business",
    "entityId": "ent_6",
    "business": "Business Name 2",
    "ip": "192.168.1.6",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 6"
  },
  {
    "id": "aud_11007",
    "timestamp": "2026-09-22 23:23:47",
    "admin": "admin2@technovanam.com",
    "action": "RESOLVE_TICKET",
    "entity": "Ticket",
    "entityId": "ent_7",
    "business": "Business Name 3",
    "ip": "192.168.1.7",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 7"
  },
  {
    "id": "aud_11008",
    "timestamp": "2026-09-22 22:23:47",
    "admin": "admin3@technovanam.com",
    "action": "LOGIN",
    "entity": "Auth",
    "entityId": "ent_8",
    "business": "Business Name 4",
    "ip": "192.168.1.8",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 8"
  },
  {
    "id": "aud_11009",
    "timestamp": "2026-09-22 21:23:47",
    "admin": "admin1@technovanam.com",
    "action": "UPDATE_PLAN",
    "entity": "Plan",
    "entityId": "ent_9",
    "business": "Business Name 5",
    "ip": "192.168.1.9",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 9"
  },
  {
    "id": "aud_11010",
    "timestamp": "2026-09-22 20:23:47",
    "admin": "admin2@technovanam.com",
    "action": "SUSPEND_BUSINESS",
    "entity": "Business",
    "entityId": "ent_10",
    "business": "Business Name 1",
    "ip": "192.168.1.10",
    "device": "Desktop - Windows 11",
    "result": "Failed",
    "details": "Performed action 10"
  },
  {
    "id": "aud_11011",
    "timestamp": "2026-09-22 19:23:47",
    "admin": "admin3@technovanam.com",
    "action": "RESOLVE_TICKET",
    "entity": "Ticket",
    "entityId": "ent_11",
    "business": "Business Name 2",
    "ip": "192.168.1.11",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 11"
  },
  {
    "id": "aud_11012",
    "timestamp": "2026-09-22 18:23:47",
    "admin": "admin1@technovanam.com",
    "action": "LOGIN",
    "entity": "Auth",
    "entityId": "ent_12",
    "business": "Business Name 3",
    "ip": "192.168.1.12",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 12"
  },
  {
    "id": "aud_11013",
    "timestamp": "2026-09-22 17:23:47",
    "admin": "admin2@technovanam.com",
    "action": "UPDATE_PLAN",
    "entity": "Plan",
    "entityId": "ent_13",
    "business": "Business Name 4",
    "ip": "192.168.1.13",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 13"
  },
  {
    "id": "aud_11014",
    "timestamp": "2026-09-22 16:23:47",
    "admin": "admin3@technovanam.com",
    "action": "SUSPEND_BUSINESS",
    "entity": "Business",
    "entityId": "ent_14",
    "business": "Business Name 5",
    "ip": "192.168.1.14",
    "device": "Desktop - Windows 11",
    "result": "Success",
    "details": "Performed action 14"
  }
];
const INITIAL_LOGIN_ACTIVITY = [
  {
    "id": "log_12000",
    "timestamp": "2026-09-23 06:23:47",
    "email": "user1@example.com",
    "ip": "10.0.0.0",
    "location": "Mumbai",
    "status": "Failed",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12001",
    "timestamp": "2026-09-23 05:53:47",
    "email": "user2@example.com",
    "ip": "10.0.0.1",
    "location": "Delhi",
    "status": "Success",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12002",
    "timestamp": "2026-09-23 05:23:47",
    "email": "user3@example.com",
    "ip": "10.0.0.2",
    "location": "Bangalore",
    "status": "Success",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12003",
    "timestamp": "2026-09-23 04:53:47",
    "email": "user4@example.com",
    "ip": "10.0.0.3",
    "location": "Mumbai",
    "status": "Success",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12004",
    "timestamp": "2026-09-23 04:23:47",
    "email": "user5@example.com",
    "ip": "10.0.0.4",
    "location": "Delhi",
    "status": "Success",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12005",
    "timestamp": "2026-09-23 03:53:47",
    "email": "user6@example.com",
    "ip": "10.0.0.5",
    "location": "Bangalore",
    "status": "Failed",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12006",
    "timestamp": "2026-09-23 03:23:47",
    "email": "user7@example.com",
    "ip": "10.0.0.6",
    "location": "Mumbai",
    "status": "Success",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12007",
    "timestamp": "2026-09-23 02:53:47",
    "email": "user8@example.com",
    "ip": "10.0.0.7",
    "location": "Delhi",
    "status": "Success",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12008",
    "timestamp": "2026-09-23 02:23:47",
    "email": "user9@example.com",
    "ip": "10.0.0.8",
    "location": "Bangalore",
    "status": "Success",
    "device": "Chrome / Windows"
  },
  {
    "id": "log_12009",
    "timestamp": "2026-09-23 01:53:47",
    "email": "user10@example.com",
    "ip": "10.0.0.9",
    "location": "Mumbai",
    "status": "Success",
    "device": "Chrome / Windows"
  }
];
const INITIAL_SESSIONS = [
  {
    "id": "sess_13000",
    "userId": "usr_2000",
    "userName": "User 1",
    "ip": "192.168.0.0",
    "device": "Safari / macOS",
    "startedAt": "2026-09-23 06:23:47",
    "lastActive": "2026-09-23 06:23:47",
    "current": true
  },
  {
    "id": "sess_13001",
    "userId": "usr_2001",
    "userName": "User 2",
    "ip": "192.168.0.1",
    "device": "Safari / macOS",
    "startedAt": "2026-09-23 04:23:47",
    "lastActive": "2026-09-23 06:13:47",
    "current": false
  },
  {
    "id": "sess_13002",
    "userId": "usr_2002",
    "userName": "User 3",
    "ip": "192.168.0.2",
    "device": "Safari / macOS",
    "startedAt": "2026-09-23 02:23:47",
    "lastActive": "2026-09-23 06:03:47",
    "current": false
  },
  {
    "id": "sess_13003",
    "userId": "usr_2003",
    "userName": "User 4",
    "ip": "192.168.0.3",
    "device": "Safari / macOS",
    "startedAt": "2026-09-23 00:23:47",
    "lastActive": "2026-09-23 05:53:47",
    "current": false
  },
  {
    "id": "sess_13004",
    "userId": "usr_2004",
    "userName": "User 5",
    "ip": "192.168.0.4",
    "device": "Safari / macOS",
    "startedAt": "2026-09-22 22:23:47",
    "lastActive": "2026-09-23 05:43:47",
    "current": false
  },
  {
    "id": "sess_13005",
    "userId": "usr_2005",
    "userName": "User 6",
    "ip": "192.168.0.5",
    "device": "Safari / macOS",
    "startedAt": "2026-09-22 20:23:47",
    "lastActive": "2026-09-23 05:33:47",
    "current": false
  },
  {
    "id": "sess_13006",
    "userId": "usr_2006",
    "userName": "User 7",
    "ip": "192.168.0.6",
    "device": "Safari / macOS",
    "startedAt": "2026-09-22 18:23:47",
    "lastActive": "2026-09-23 05:23:47",
    "current": false
  },
  {
    "id": "sess_13007",
    "userId": "usr_2007",
    "userName": "User 8",
    "ip": "192.168.0.7",
    "device": "Safari / macOS",
    "startedAt": "2026-09-22 16:23:47",
    "lastActive": "2026-09-23 05:13:47",
    "current": false
  },
  {
    "id": "sess_13008",
    "userId": "usr_2008",
    "userName": "User 9",
    "ip": "192.168.0.8",
    "device": "Safari / macOS",
    "startedAt": "2026-09-22 14:23:47",
    "lastActive": "2026-09-23 05:03:47",
    "current": false
  },
  {
    "id": "sess_13009",
    "userId": "usr_2009",
    "userName": "User 10",
    "ip": "192.168.0.9",
    "device": "Safari / macOS",
    "startedAt": "2026-09-22 12:23:47",
    "lastActive": "2026-09-23 04:53:47",
    "current": false
  }
];
const INITIAL_BACKUPS = [
  {
    "id": "bak_14000",
    "filename": "technovanam_full_snapshot_14000.enc",
    "size": "380.0 MB",
    "status": "Failed",
    "createdDate": "2026-09-23 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14001",
    "filename": "technovanam_full_snapshot_14001.enc",
    "size": "390.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-22 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14002",
    "filename": "technovanam_full_snapshot_14002.enc",
    "size": "400.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-21 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14003",
    "filename": "technovanam_full_snapshot_14003.enc",
    "size": "410.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-20 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14004",
    "filename": "technovanam_full_snapshot_14004.enc",
    "size": "420.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-19 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14005",
    "filename": "technovanam_full_snapshot_14005.enc",
    "size": "430.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-18 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14006",
    "filename": "technovanam_full_snapshot_14006.enc",
    "size": "440.0 MB",
    "status": "Failed",
    "createdDate": "2026-09-17 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14007",
    "filename": "technovanam_full_snapshot_14007.enc",
    "size": "450.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-16 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14008",
    "filename": "technovanam_full_snapshot_14008.enc",
    "size": "460.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-15 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  },
  {
    "id": "bak_14009",
    "filename": "technovanam_full_snapshot_14009.enc",
    "size": "470.0 MB",
    "status": "Completed",
    "createdDate": "2026-09-14 06:23:47",
    "storage": "Firebase Cloud Storage (Coldline)"
  }
];

const INITIAL_SETTINGS = {
  platformName: "Techno Vanam SaaS",
  tagline: "Intelligent Cloud Billing & Multi-Outlet Commerce Platform",
  logoURL: "/logo@4x-8.png",
  faviconURL: "/Icon@4x-8.png",
  supportEmail: "support@technovanam.com",
  supportPhone: "+91 80000 12345",
  defaultCurrency: "INR (₹)",
  timezone: "Asia/Kolkata (GMT+05:30)",
  dateFormat: "DD/MM/YYYY",
  smtp: {
    host: "smtp.gmail.com",
    port: 465,
    senderEmail: "notifications@technovanam.com",
    senderName: "Techno Vanam Cloud",
    configured: true,
  },
  sms: {
    provider: "Twilio / Gupshup",
    senderId: "TECHNO",
    configured: true,
  },
  whatsapp: {
    provider: "Meta WhatsApp Cloud API",
    wabaId: "1098234812398",
    configured: true,
  },
  paymentGateway: {
    provider: "Razorpay Standard Checkout",
    keyId: "rzp_live_••••••••••••",
    webhookConfigured: true,
  },
  integrations: {
    gstPortal: true,
    eInvoiceNIC: true,
    eWayBillNIC: true,
    tallyConnector: true,
  },
};



const INITIAL_ROLES = [
  {
    id: "Super Admin",
    name: "Super Admin",
    description: "Full unrestricted platform access",
    userCount: 1,
    permissions: {
      "View Businesses": true,
      "Create Business": true,
      "Edit Business": true,
      "Suspend Business": true,
      "Activate Business": true,
      "Delete Business": true,
      "View Subscriptions": true,
      "Change Plan": true,
      "Cancel Plan": true,
      "Extend Terms": true,
      "View Payments": true,
      "Process Refund": true,
      "View Users": true,
      "Suspend User": true,
      "Reset Password": true,
      "View Analytics": true,
      "Export CSV": true,
      "View Settings": true,
      "Edit Gateway & SMTP": true,
    },
  },
  {
    id: "Platform Admin",
    name: "Platform Admin",
    description: "Standard administrator operations",
    userCount: 2,
    permissions: {
      "View Businesses": true,
      "Create Business": true,
      "Edit Business": true,
      "Suspend Business": true,
      "Activate Business": true,
      "Delete Business": false,
      "View Subscriptions": true,
      "Change Plan": true,
      "Cancel Plan": true,
      "Extend Terms": true,
      "View Payments": true,
      "Process Refund": true,
      "View Users": true,
      "Suspend User": true,
      "Reset Password": true,
      "View Analytics": true,
      "Export CSV": true,
      "View Settings": true,
      "Edit Gateway & SMTP": false,
    },
  },
  {
    id: "Finance Admin",
    name: "Finance Admin",
    description: "Billing, plans, and payments access",
    userCount: 1,
    permissions: {
      "View Businesses": true,
      "Create Business": false,
      "Edit Business": false,
      "Suspend Business": false,
      "Activate Business": false,
      "Delete Business": false,
      "View Subscriptions": true,
      "Change Plan": true,
      "Cancel Plan": true,
      "Extend Terms": true,
      "View Payments": true,
      "Process Refund": true,
      "View Users": false,
      "Suspend User": false,
      "Reset Password": false,
      "View Analytics": true,
      "Export CSV": true,
      "View Settings": false,
      "Edit Gateway & SMTP": false,
    },
  },
  {
    id: "Support Admin",
    name: "Support Admin",
    description: "Customer support and tenant management",
    userCount: 3,
    permissions: {
      "View Businesses": true,
      "Create Business": false,
      "Edit Business": false,
      "Suspend Business": false,
      "Activate Business": false,
      "Delete Business": false,
      "View Subscriptions": true,
      "Change Plan": false,
      "Cancel Plan": false,
      "Extend Terms": false,
      "View Payments": true,
      "Process Refund": false,
      "View Users": true,
      "Suspend User": true,
      "Reset Password": true,
      "View Analytics": false,
      "Export CSV": false,
      "View Settings": false,
      "Edit Gateway & SMTP": false,
    },
  },
  {
    id: "Operations Admin",
    name: "Operations Admin",
    description: "Operations and fleet management",
    userCount: 1,
    permissions: {
      "View Businesses": true,
      "Create Business": true,
      "Edit Business": true,
      "Suspend Business": true,
      "Activate Business": true,
      "Delete Business": false,
      "View Subscriptions": false,
      "Change Plan": false,
      "Cancel Plan": false,
      "Extend Terms": false,
      "View Payments": false,
      "Process Refund": false,
      "View Users": true,
      "Suspend User": false,
      "Reset Password": false,
      "View Analytics": true,
      "Export CSV": true,
      "View Settings": false,
      "Edit Gateway & SMTP": false,
    },
  },
  {
    id: "Read Only Admin",
    name: "Read Only Admin",
    description: "Auditing and reporting view-only",
    userCount: 2,
    permissions: {
      "View Businesses": true,
      "Create Business": false,
      "Edit Business": false,
      "Suspend Business": false,
      "Activate Business": false,
      "Delete Business": false,
      "View Subscriptions": true,
      "Change Plan": false,
      "Cancel Plan": false,
      "Extend Terms": false,
      "View Payments": true,
      "Process Refund": false,
      "View Users": true,
      "Suspend User": false,
      "Reset Password": false,
      "View Analytics": true,
      "Export CSV": true,
      "View Settings": true,
      "Edit Gateway & SMTP": false,
    },
  },
];

const INITIAL_INVOICES = [
  {
    id: "inv_1001",
    invoiceNo: "INV-2026-001",
    businessId: "bus_1000",
    businessName: "Business Name 1",
    customerName: "Acme Enterprises",
    amount: 14500,
    total: 14500,
    status: "Paid",
    date: "2026-09-20",
    dueDate: "2026-10-20",
  },
  {
    id: "inv_1002",
    invoiceNo: "INV-2026-002",
    businessId: "bus_1001",
    businessName: "Business Name 2",
    customerName: "Global Logistics Ltd",
    amount: 8200,
    total: 8200,
    status: "Paid",
    date: "2026-09-21",
    dueDate: "2026-10-21",
  },
  {
    id: "inv_1003",
    invoiceNo: "INV-2026-003",
    businessId: "bus_1002",
    businessName: "Business Name 3",
    customerName: "Metro Retailers",
    amount: 22400,
    total: 22400,
    status: "Pending",
    date: "2026-09-22",
    dueDate: "2026-10-05",
  },
  {
    id: "inv_1004",
    invoiceNo: "INV-2026-004",
    businessId: "bus_1003",
    businessName: "Business Name 4",
    customerName: "Zenith Tech Solutions",
    amount: 35000,
    total: 35000,
    status: "Paid",
    date: "2026-09-23",
    dueDate: "2026-10-23",
  },
  {
    id: "inv_1005",
    invoiceNo: "INV-2026-005",
    businessId: "bus_1004",
    businessName: "Business Name 5",
    customerName: "Pioneer Trading Co",
    amount: 5600,
    total: 5600,
    status: "Overdue",
    date: "2026-08-15",
    dueDate: "2026-09-15",
  },
];

const INITIAL_MAINTENANCE = {
  enabled: false,
  scheduledStart: "",
  scheduledEnd: "",
  bannerMessage: "Techno Vanam Cloud is scheduled for routine performance optimization on Sunday 02:00 AM - 04:00 AM IST. Offline POS will continue operating smoothly.",
  allowSuperAdminBypass: true,
};

// Data Store Helper Class
class SuperAdminDataService {
  constructor() {
    this.init();
  }

  init() {
    Object.entries({
      [STORAGE_KEYS.BUSINESSES]: INITIAL_BUSINESSES,
      [STORAGE_KEYS.USERS]: INITIAL_USERS,
      [STORAGE_KEYS.BRANCHES]: INITIAL_BRANCHES,
      [STORAGE_KEYS.GODOWNS]: INITIAL_GODOWNS,
      [STORAGE_KEYS.TERMINALS]: INITIAL_TERMINALS,
      [STORAGE_KEYS.PAYMENTS]: INITIAL_PAYMENTS,
      [STORAGE_KEYS.COUPONS]: INITIAL_COUPONS,
      [STORAGE_KEYS.TICKETS]: INITIAL_TICKETS,
      [STORAGE_KEYS.ANNOUNCEMENTS]: INITIAL_ANNOUNCEMENTS,
      [STORAGE_KEYS.ADMIN_USERS]: INITIAL_ADMIN_USERS,
      [STORAGE_KEYS.ROLES]: INITIAL_ROLES,
      [STORAGE_KEYS.INVOICES]: INITIAL_INVOICES,
      [STORAGE_KEYS.AUDIT_LOGS]: INITIAL_AUDIT_LOGS,
      [STORAGE_KEYS.LOGIN_ACTIVITY]: INITIAL_LOGIN_ACTIVITY,
      [STORAGE_KEYS.SESSIONS]: INITIAL_SESSIONS,
      [STORAGE_KEYS.SETTINGS]: INITIAL_SETTINGS,
      [STORAGE_KEYS.BACKUPS]: INITIAL_BACKUPS,
      [STORAGE_KEYS.MAINTENANCE]: INITIAL_MAINTENANCE,
    }).forEach(([key, fallback]) => {
      const existing = localStorage.getItem(key);
      if (!existing || existing === "[]" || existing === "{}") {
        localStorage.setItem(key, JSON.stringify(fallback));
      }
    });
    
    // Force reset plans to remove previously created duplicate plans
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(INITIAL_PLANS));
  }

  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error("SuperAdmin storage error:", err);
    }
  }

  // Audit Log recording
  logAudit(action, entity, entityId, business, details = "", result = "Success") {
    const logs = this.get(STORAGE_KEYS.AUDIT_LOGS) || [];
    const newEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString().replace("T", " ").substr(0, 19),
      admin: "admin@technovanam.com",
      action,
      entity,
      entityId,
      business: business || "Platform",
      ip: "103.120.45.10",
      device: "Desktop - Windows 11",
      result,
      details,
    };
    const updated = [newEntry, ...logs];
    this.set(STORAGE_KEYS.AUDIT_LOGS, updated);
    return newEntry;
  }

  // Businesses
  getBusinesses() {
    return this.get(STORAGE_KEYS.BUSINESSES) || [];
  }

  getBusinessById(id) {
    return this.getBusinesses().find((b) => b.id === id);
  }

  updateBusiness(id, patch) {
    const list = this.getBusinesses();
    const updated = list.map((b) => (b.id === id ? { ...b, ...patch } : b));
    this.set(STORAGE_KEYS.BUSINESSES, updated);
    this.logAudit("BUSINESS_UPDATED", "Business", id, patch.name || id, `Updated fields: ${Object.keys(patch).join(", ")}`);
    return updated.find((b) => b.id === id);
  }

  toggleBusinessStatus(id, newStatus) {
    const list = this.getBusinesses();
    const target = list.find((b) => b.id === id);
    if (!target) return null;
    const updated = list.map((b) => (b.id === id ? { ...b, status: newStatus } : b));
    this.set(STORAGE_KEYS.BUSINESSES, updated);
    const action = newStatus === "Suspended" ? "BUSINESS_SUSPENDED" : "BUSINESS_ACTIVATED";
    this.logAudit(action, "Business", id, target.name, `Status set to ${newStatus}`);
    return updated.find((b) => b.id === id);
  }

  // Plans
  getPlans() {
    return this.get(STORAGE_KEYS.PLANS) || [];
  }

  updatePlan(id, patch) {
    const list = this.getPlans();
    const updated = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
    this.set(STORAGE_KEYS.PLANS, updated);
    this.logAudit("PLAN_UPDATED", "Plan", id, "Platform", `Modified plan: ${id}`);
    return updated.find((p) => p.id === id);
  }

  // Users
  getUsers() {
    return this.get(STORAGE_KEYS.USERS) || [];
  }

  toggleUserStatus(id, newStatus) {
    const list = this.getUsers();
    const updated = list.map((u) => (u.id === id ? { ...u, status: newStatus } : u));
    this.set(STORAGE_KEYS.USERS, updated);
    this.logAudit("USER_STATUS_CHANGED", "User", id, "Platform", `User status changed to ${newStatus}`);
    return updated.find((u) => u.id === id);
  }

  // Branches, Godowns, Terminals
  getBranches() {
    return this.get(STORAGE_KEYS.BRANCHES) || [];
  }

  getGodowns() {
    return this.get(STORAGE_KEYS.GODOWNS) || [];
  }

  getTerminals() {
    return this.get(STORAGE_KEYS.TERMINALS) || [];
  }

  updateTerminalStatus(id, newStatus) {
    const list = this.getTerminals();
    const updated = list.map((t) => (t.id === id ? { ...t, status: newStatus } : t));
    this.set(STORAGE_KEYS.TERMINALS, updated);
    this.logAudit("TERMINAL_STATUS_CHANGED", "POS Terminal", id, "Platform", `Terminal status set to ${newStatus}`);
    return updated.find((t) => t.id === id);
  }

  // Payments & Invoices
  getPayments() {
    return this.get(STORAGE_KEYS.PAYMENTS) || [];
  }

  getInvoices() {
    return this.get(STORAGE_KEYS.INVOICES) || [];
  }

  refundPayment(id, reason) {
    const list = this.getPayments();
    const target = list.find((p) => p.id === id);
    if (!target) return null;
    const updated = list.map((p) => (p.id === id ? { ...p, status: "Refunded" } : p));
    this.set(STORAGE_KEYS.PAYMENTS, updated);
    this.logAudit("PAYMENT_REFUNDED", "Payment", id, target.businessName, `Refund processed. Reason: ${reason}`);
    return updated.find((p) => p.id === id);
  }

  // Coupons
  getCoupons() {
    return this.get(STORAGE_KEYS.COUPONS) || [];
  }

  addCoupon(coupon) {
    const list = this.getCoupons();
    const newCoupon = {
      ...coupon,
      id: `coup_${Date.now()}`,
      usedCount: 0,
      status: "Active",
    };
    const updated = [newCoupon, ...list];
    this.set(STORAGE_KEYS.COUPONS, updated);
    this.logAudit("COUPON_CREATED", "Coupon", newCoupon.code, "Platform", `Created coupon ${newCoupon.code}`);
    return newCoupon;
  }

  // Tickets
  getTickets() {
    return this.get(STORAGE_KEYS.TICKETS) || [];
  }

  updateTicket(id, patch) {
    const list = this.getTickets();
    const updated = list.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: "Just now" } : t));
    this.set(STORAGE_KEYS.TICKETS, updated);
    this.logAudit("TICKET_UPDATED", "Support Ticket", id, "Platform", `Ticket updated: ${id}`);
    return updated.find((t) => t.id === id);
  }

  addTicketReply(id, sender, text) {
    const list = this.getTickets();
    const target = list.find((t) => t.id === id);
    if (!target) return null;
    const newReply = { sender, text, time: "Just now" };
    const updated = list.map((t) =>
      t.id === id ? { ...t, conversation: [...(t.conversation || []), newReply], updatedAt: "Just now" } : t
    );
    this.set(STORAGE_KEYS.TICKETS, updated);
    return updated.find((t) => t.id === id);
  }

  // Announcements
  getAnnouncements() {
    return this.get(STORAGE_KEYS.ANNOUNCEMENTS) || [];
  }

  addAnnouncement(announcement) {
    const list = this.getAnnouncements();
    const newAnc = {
      ...announcement,
      id: `anc_${Date.now()}`,
      publishedAt: new Date().toISOString().slice(0, 10),
      active: true,
    };
    const updated = [newAnc, ...list];
    this.set(STORAGE_KEYS.ANNOUNCEMENTS, updated);
    this.logAudit("ANNOUNCEMENT_CREATED", "Announcement", newAnc.id, "Platform", `Published: ${newAnc.title}`);
    return newAnc;
  }

  // Admin Users & Roles
  getAdminUsers() {
    return this.get(STORAGE_KEYS.ADMIN_USERS) || [];
  }

  getRoles() {
    return this.get(STORAGE_KEYS.ROLES) || [];
  }

  addAdminUser(user) {
    const list = this.getAdminUsers();
    const newUser = {
      ...user,
      id: `adm_${Date.now()}`,
      status: "Active",
      lastLogin: "Never",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const updated = [...list, newUser];
    this.set(STORAGE_KEYS.ADMIN_USERS, updated);
    this.logAudit("ADMIN_USER_CREATED", "Admin User", newUser.id, "Platform", `Created staff admin ${newUser.email}`);
    return newUser;
  }

  // Audit Logs & Login Activity
  getAuditLogs() {
    return this.get(STORAGE_KEYS.AUDIT_LOGS) || [];
  }

  getLoginActivity() {
    return this.get(STORAGE_KEYS.LOGIN_ACTIVITY) || [];
  }

  getSessions() {
    return this.get(STORAGE_KEYS.SESSIONS) || [];
  }

  terminateSession(id) {
    const list = this.getSessions();
    const updated = list.filter((s) => s.id !== id);
    this.set(STORAGE_KEYS.SESSIONS, updated);
    this.logAudit("SESSION_TERMINATED", "Session", id, "Platform", `Terminated session ${id}`);
    return updated;
  }

  terminateAllOtherSessions() {
    const list = this.getSessions();
    const currentOnly = list.filter((s) => s.current);
    this.set(STORAGE_KEYS.SESSIONS, currentOnly);
    this.logAudit("ALL_SESSIONS_TERMINATED", "Sessions", "ALL", "Platform", "Terminated all secondary sessions");
    return currentOnly;
  }

  // Settings
  getSettings() {
    return this.get(STORAGE_KEYS.SETTINGS) || INITIAL_SETTINGS;
  }

  updateSettings(patch) {
    const current = this.getSettings();
    const updated = { ...current, ...patch };
    this.set(STORAGE_KEYS.SETTINGS, updated);
    this.logAudit("SETTINGS_CHANGED", "System Settings", "global", "Platform", `Updated settings`);
    return updated;
  }

  // Backups
  getBackups() {
    return this.get(STORAGE_KEYS.BACKUPS) || [];
  }

  createBackup() {
    const list = this.getBackups();
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T.]/g, "").slice(0, 12);
    const newBackup = {
      id: `bak_${stamp}`,
      filename: `technovanam_full_snapshot_${stamp}.enc`,
      size: `${(380 + Math.random() * 40).toFixed(1)} MB`,
      status: "Completed",
      createdDate: `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      storage: "Firebase Cloud Storage (Coldline)",
    };
    const updated = [newBackup, ...list];
    this.set(STORAGE_KEYS.BACKUPS, updated);
    this.logAudit("BACKUP_CREATED", "Database Backup", newBackup.id, "Platform", `Triggered on-demand system backup`);
    return newBackup;
  }

  // Maintenance
  getMaintenance() {
    return this.get(STORAGE_KEYS.MAINTENANCE) || INITIAL_MAINTENANCE;
  }

  updateMaintenance(patch) {
    const current = this.getMaintenance();
    const updated = { ...current, ...patch };
    this.set(STORAGE_KEYS.MAINTENANCE, updated);
    this.logAudit(
      updated.enabled ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED",
      "Maintenance Mode",
      "global",
      "Platform",
      `Maintenance is now ${updated.enabled ? "ACTIVE" : "INACTIVE"}`
    );
    return updated;
  }
}

export const superAdminService = new SuperAdminDataService();
