from enum import Enum

class MapTypes(Enum):
    AIR = "air"
    WALL = "wall"
    BLUE_ORE = "blue_ore"
    YELLOW_ORE = "yellow_ore"
    GREEN_ORE = "green_ore"
    START = "start"

class BaseMapBlock():
    def __init__(self):
        self.type:MapTypes

class AirMapBlock(BaseMapBlock):
    def __init__(self):
        self.type = MapTypes.AIR

class WallMapBlock(BaseMapBlock):
    def __init__(self):
        self.type = MapTypes.WALL

class BlueOreMapBlock(BaseMapBlock):
    def __init__(self):
        self.type = MapTypes.BLUE_ORE

class YellowOreMapBlock(BaseMapBlock):
    def __init__(self):
        self.type = MapTypes.YELLOW_ORE

class GreenOreMapBlock(BaseMapBlock):
    def __init__(self):
        self.type = MapTypes.GREEN_ORE

class StartMapBlock(BaseMapBlock):
    def __init__(self):
        self.type = MapTypes.START