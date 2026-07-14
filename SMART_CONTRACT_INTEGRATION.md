# Smart Contract Integration Guide

## Overview

Your CIAS project now has full smart contract integration! This guide explains how to set up and use the blockchain features.

## What's Been Added

### 1. Smart Contract System
- **ClaimRegistry.sol**: Main contract for policies and claims
- **Hardhat Setup**: Development and deployment environment
- **Tests**: Comprehensive test suite
- **Deployment Scripts**: Automated deployment to different networks

### 2. Frontend Integration
- **Enhanced Web3Service**: Now includes smart contract methods
- **ClaimService**: High-level service integrating blockchain with Firebase
- **Event Listening**: Real-time blockchain event monitoring

### 3. Key Features
- ✅ **Blockchain Policies**: Create insurance policies on-chain
- ✅ **Immutable Claims**: Submit claims to blockchain for transparency
- ✅ **Event Tracking**: Real-time updates via blockchain events
- ✅ **Hybrid Storage**: Firebase for UI, blockchain for critical data
- ✅ **Gas Optimization**: Efficient contract design
- ✅ **Security**: Access control and reentrancy protection

## Quick Start

### 1. Install Blockchain Dependencies
```bash
npm run blockchain:install
```

### 2. Compile Contracts
```bash
npm run blockchain:compile
```

### 3. Run Tests
```bash
npm run blockchain:test
```

### 4. Deploy to Local Network
```bash
# Terminal 1: Start local blockchain
npm run blockchain:node

# Terminal 2: Deploy contracts
npm run blockchain:deploy:local
```

### 5. Update Frontend Configuration
After deployment, update your `.env` file:
```env
VITE_CLAIM_REGISTRY_ADDRESS=0x... # Contract address from deployment
```

## How It Works

### Policy Creation Flow
1. User registers car in Firebase
2. User pays premium via existing payment system
3. **NEW**: Policy is created on blockchain with vehicle info
4. Policy ID is stored in Firebase for reference

### Claim Submission Flow
1. User submits claim via existing UI
2. Claim is saved to Firebase immediately (for UI responsiveness)
3. **NEW**: Claim is submitted to blockchain with damage details
4. Blockchain transaction hash is stored in Firebase
5. Real-time events update the UI

### Claim Review Flow
1. Insurance company reviews claim in admin panel
2. **NEW**: Claim status is updated on blockchain
3. **NEW**: Approved claims can be paid automatically
4. Payment events trigger UI updates

## Smart Contract Functions

### For Users
```javascript
// Create policy after car registration
await claimService.createPolicy(carData, premium, coverageAmount);

// Submit claim
await claimService.submitClaim(claimData, imageHashes);

// Get user's policies
const policies = await claimService.getUserPolicies(userAddress);

// Get user's claims
const claims = await claimService.getUserClaims(userAddress);
```

### For Insurance Company (Admin)
```javascript
// Review claim (requires owner access)
await web3Service.contract.reviewClaim(claimId, status, notes);

// Pay approved claim
await web3Service.contract.payClaim(claimId);

// Get contract balance
const balance = await claimService.getContractBalance();
```

## Event Listening

Listen to blockchain events for real-time updates:

```javascript
// Listen for new policies
claimService.listenToEvents('PolicyCreated', (policyId, policyholder, premium, coverage) => {
  console.log('New policy created:', policyId.toString());
  // Update UI
});

// Listen for claim submissions
claimService.listenToEvents('ClaimSubmitted', (claimId, policyId, claimant, damageType, cost) => {
  console.log('New claim submitted:', claimId.toString());
  // Update UI
});

// Listen for claim payments
claimService.listenToEvents('ClaimPaid', (claimId, amount) => {
  console.log('Claim paid:', claimId.toString(), amount.toString());
  // Update UI
});
```

## Integration Points

### 1. Car Registration
- **File**: `src/pages/CarRegistration/CarRegistration.jsx`
- **Integration**: After successful registration, create blockchain policy
- **Code**: Add `claimService.createPolicy()` call

### 2. Claim Submission
- **File**: `src/pages/Claim/Claim.jsx`
- **Integration**: After AI analysis, submit to blockchain
- **Code**: Use `claimService.submitClaim()` instead of just Firebase

### 3. Payment System
- **File**: `src/pages/Payment/Payment.jsx`
- **Integration**: After payment, create blockchain policy
- **Code**: Add policy creation after successful payment

### 4. Dashboard
- **File**: `src/pages/Dashboard/Dashboard.jsx`
- **Integration**: Display blockchain policies and claims
- **Code**: Use `claimService.getUserPolicies()` and `getUserClaims()`

## Deployment Options

### 1. Local Development
- Use Hardhat local network
- No real ETH required
- Perfect for testing

### 2. Testnet (Sepolia)
- Real blockchain, test ETH
- Good for integration testing
- Free test ETH from faucets

### 3. Mainnet
- Production deployment
- Real ETH required
- Permanent and immutable

## Security Considerations

### 1. Private Keys
- Never commit private keys to version control
- Use environment variables
- Consider hardware wallets for production

### 2. Access Control
- Only contract owner can review/approve claims
- Users can only submit claims for their own policies
- All functions have proper access controls

### 3. Gas Optimization
- Contracts are optimized for gas efficiency
- Batch operations where possible
- Minimal external calls

## Monitoring and Maintenance

### 1. Event Monitoring
- Set up event listeners for important events
- Log all blockchain transactions
- Monitor contract balance

### 2. Error Handling
- All functions return success/error status
- Graceful fallbacks to Firebase if blockchain fails
- User-friendly error messages

### 3. Updates
- Smart contracts are immutable once deployed
- Plan upgrades carefully
- Consider proxy patterns for future updates

## Troubleshooting

### Common Issues

1. **Contract not initialized**
   - Check if contract address is set in .env
   - Ensure wallet is connected
   - Verify network connection

2. **Transaction fails**
   - Check gas limit
   - Verify user has sufficient ETH
   - Check contract permissions

3. **Events not firing**
   - Ensure event listeners are set up
   - Check network connectivity
   - Verify event names match

### Debug Commands
```bash
# Check contract compilation
npm run blockchain:compile

# Run tests
npm run blockchain:test

# Check deployment
npm run blockchain:deploy:local
```

## Next Steps

1. **Test Integration**: Deploy to local network and test all features
2. **UI Updates**: Integrate blockchain data into existing UI components
3. **Admin Panel**: Create admin interface for claim review
4. **Monitoring**: Set up event monitoring and logging
5. **Production**: Deploy to testnet, then mainnet

## Support

- Check the blockchain README for detailed setup
- Review test files for usage examples
- Contact the development team for assistance

Your CIAS project now has enterprise-grade blockchain integration! 🚀
