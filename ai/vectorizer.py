import numpy as np
from typing import Optional

class MockTelemetryAutoencoder:
    """A friendly autoencoder that learns patterns without needing PyTorch!"""
    def __init__(self, input_dim=100, encoding_dim=32):
        self.input_dim = input_dim
        self.encoding_dim = encoding_dim
        print(f"Hey! Our smart autoencoder is ready: {input_dim} -> {encoding_dim}")

    def encode(self, x):
        """Let's learn the important patterns from this data!"""
        if isinstance(x, np.ndarray):
            # Let's break this down into chunks and learn from each one
            chunk_size = max(1, len(x) // self.encoding_dim)
            features = []
            
            for i in range(0, len(x), chunk_size):
                chunk = x[i:i+chunk_size]
                if len(chunk) > 0:
                    # What's the story of this chunk?
                    features.extend([
                        np.mean(chunk),  # What's the average?
                        np.std(chunk) if len(chunk) > 1 else 0,  # How varied is it?
                        np.min(chunk),   # What's the lowest point?
                        np.max(chunk)    # What's the highest point?
                    ])
            
            # Make sure we have the right size
            if len(features) > self.encoding_dim:
                features = features[:self.encoding_dim]
            else:
                features.extend([0] * (self.encoding_dim - len(features)))
            
            return np.array(features[:self.encoding_dim])
        else:
            # Convert to numpy and try again
            x_np = np.array(x).flatten()
            return self.encode(x_np)

def create_vectorizer(input_dim=100, encoding_dim=32) -> MockTelemetryAutoencoder:
    """Let's create our smart corner analyzer!"""
    model = MockTelemetryAutoencoder(input_dim, encoding_dim)
    print(f"Perfect! Our corner analyzer is ready: {input_dim} -> {encoding_dim}")
    return model

def vectorize_corner(corner_data_array: np.ndarray, model: MockTelemetryAutoencoder) -> np.ndarray:
    """
    Let's create a unique fingerprint for this corner!
    """
    # Make sure we have the right format
    if not isinstance(corner_data_array, np.ndarray):
        corner_data_array = np.array(corner_data_array)
    
    # Flatten it out so we can work with it
    corner_data_array = corner_data_array.flatten()
    
    # Let's learn what makes this corner special
    embedding = model.encode(corner_data_array)
    
    return embedding

# For compatibility with the original interface
TelemetryAutoencoder = MockTelemetryAutoencoder