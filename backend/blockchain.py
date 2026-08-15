import hashlib
import json
import time

class Block:
    def __init__(self, index, timestamp, data, previous_hash, block_hash=None):
        self.index = index
        self.timestamp = timestamp
        self.data = data
        self.previous_hash = previous_hash
        self.hash = block_hash if block_hash else self.calculate_hash()

    def calculate_hash(self):
        # We ensure JSON serialization keys are sorted so hash outputs are deterministic
        data_str = json.dumps(self.data, sort_keys=True)
        block_string = f"{self.index}{self.timestamp}{data_str}{self.previous_hash}".encode()
        return hashlib.sha256(block_string).hexdigest()

class Blockchain:
    def __init__(self, existing_blocks=None):
        """
        Allows loading an existing chain list from the database.
        If empty, initializes a new chain starting with the Genesis block.
        """
        if existing_blocks:
            self.chain = existing_blocks
        else:
            self.chain = [self.create_genesis_block()]

    def create_genesis_block(self):
        return Block(
            index=0,
            timestamp=1704067200.0, # Fixed timestamp: 2024-01-01 00:00:00 UTC
            data={"event": "Genesis", "message": "Cryptographic Audit Ledger Initialized"},
            previous_hash="0"
        )

    def get_latest_block(self):
        return self.chain[-1]

    def add_block(self, data):
        latest_block = self.get_latest_block()
        new_block = Block(
            index=latest_block.index + 1,
            timestamp=time.time(),
            data=data,
            previous_hash=latest_block.hash
        )
        self.chain.append(new_block)
        return new_block

    def is_chain_valid(self):
        """
        Validates the entire blockchain sequence by verifying hashes and links.
        Returns a tuple (bool, str) representing validity status and description.
        """
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i-1]

            # 1. Recalculate block signature
            if current.hash != current.calculate_hash():
                return False, f"Invalid block hash at index {current.index}."

            # 2. Verify connection link
            if current.previous_hash != previous.hash:
                return False, f"Broken chain link between block {previous.index} and block {current.index}."

        return True, "Blockchain audit ledger is healthy and verified."
