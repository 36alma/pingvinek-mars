from services.routing.rover import RoverService
from services.map.map import MapService

def test_max_time_enforcement():
    max_times = [5.0, 10.0, 15.0, 20.0, 50.0]
    for max_time in max_times:
        max_tick = int(max_time * 2)
        print(f"\nTesting max_time={max_time} (max_tick={max_tick})")
        
        service = RoverService()
        route = service.startrouting(max_tick)
        
        final_ticks = (service.rover.day * 48) + int(service.rover.time * 2)
        final_hours = service.rover.day * 24 + service.rover.time
        
        print(f"Route length: {len(route)} moves")
        print(f"Final time: Sol {service.rover.day}, {service.rover.time}h (Total: {final_hours}h)")
        print(f"Final ticks: {final_ticks}")
        
        if final_ticks > max_tick:
            print(f"!!! BUG DETECTED: {final_ticks} > {max_tick}")
        else:
            print("Time limit respected.")

if __name__ == "__main__":
    test_max_time_enforcement()
