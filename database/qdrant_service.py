import numpy as np
from typing import List, Dict, Any
import uuid

class MockQdrantService:
    """A friendly mock service that remembers corners in memory - no Docker needed!"""
    def __init__(self, host="localhost", port=6333):
        self.collection_name = "raceup_corners"
        self.vector_size = 32
        self.corners = {}  # Our little corner memory bank
        print(f"Hey! Mock Qdrant is ready to remember corners in '{self.collection_name}'")

    def create_collection(self, vector_size=32):
        """Sets up our corner memory space"""
        self.vector_size = vector_size
        print(f"Perfect! Our corner collection '{self.collection_name}' is ready to go.")
        return True

    def upsert_corner(self, corner_id: str, vector: np.ndarray, metadata: dict):
        """Saves a corner to our memory - we'll remember this one!"""
        try:
            self.corners[corner_id] = {
                "vector": vector.tolist(),
                "metadata": {
                    "corner_id": corner_id,
                    "driver": metadata.get("driver", "unknown"),
                    "track": metadata.get("track", "unknown"),
                    "lap_number": metadata.get("lap_number", 0),
                    **metadata
                }
            }
            print(f"Got it! Remembered corner {corner_id}")
        except Exception as e:
            print(f"Oops, had trouble remembering corner {corner_id}: {e}")

    def search_similar_corners(self, query_vector: np.ndarray, limit: int = 5):
        """Let's find corners that look similar to this one!"""
        try:
            if not self.corners:
                return []
            
            # Let's see how similar each corner is
            similarities = []
            query_norm = np.linalg.norm(query_vector)
            
            for corner_id, data in self.corners.items():
                stored_vector = np.array(data["vector"])
                stored_norm = np.linalg.norm(stored_vector)
                
                if query_norm > 0 and stored_norm > 0:
                    cosine_sim = np.dot(query_vector, stored_vector) / (query_norm * stored_norm)
                    
                    # Create a mock result object
                    class MockResult:
                        def __init__(self, score, payload):
                            self.score = score
                            self.payload = payload
                    
                    similarities.append(MockResult(cosine_sim, data["metadata"]))
            
            # Sort by similarity and return the best matches
            similarities.sort(key=lambda x: x.score, reverse=True)
            return similarities[:limit]
            
        except Exception as e:
            print(f"Oops, had trouble finding similar corners: {e}")
            return []

    def get_corner_by_id(self, corner_id):
        """Get a specific corner by its ID"""
        return self.corners.get(corner_id)

# Use the mock service for now
QdrantService = MockQdrantService