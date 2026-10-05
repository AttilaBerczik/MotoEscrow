#!/bin/bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

DEPLOYER="8z4yo6AnCCUshYmzo1hqm8eaqscJRLXhX4i336oLzoGy"
echo "Watching deployer balance on Devnet: $DEPLOYER"

for i in {1..300}; do
    BAL=$(solana balance $DEPLOYER --url devnet 2>/dev/null | awk '{print $1}')
    echo "Check $i: Balance is $BAL SOL"
    
    # Check if balance is greater than 1
    if (( $(echo "$BAL > 1.1" | bc -l 2>/dev/null || echo 0) )); then
        echo "Funds detected ($BAL SOL)! Deploying program to Devnet..."
        anchor deploy --provider.cluster devnet
        solana program show 6H3xC9yvLTM8YX8ruRDHbqmGySGTuQmdKSH8oW9jjhLF --url devnet
        echo "DEPLOYMENT COMPLETE!"
        exit 0
    fi
    sleep 3
done
