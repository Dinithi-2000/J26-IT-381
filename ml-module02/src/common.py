"""Shared constants for the Module 02 visible-condition baseline."""
from pathlib import Path

# Fixed, documented class order. The index of a class in this list is its label id.
CLASSES = ["good", "discolored", "physical_damage", "suspected_surface_growth"]
IMAGE_SIZE = (224, 224)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ROOT = Path(__file__).resolve().parents[1]
