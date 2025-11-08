#!/usr/bin/env python3
"""
Test script to check if routes are registered
"""
import sys
import os
sys.path.append('/app/backend')

from server import app

print("Registered routes:")
for route in app.routes:
    if hasattr(route, 'path'):
        print(f"  {route.methods if hasattr(route, 'methods') else 'N/A'} {route.path}")
    elif hasattr(route, 'prefix'):
        print(f"  Router: {route.prefix}")
        if hasattr(route, 'routes'):
            for subroute in route.routes:
                if hasattr(subroute, 'path'):
                    print(f"    {subroute.methods if hasattr(subroute, 'methods') else 'N/A'} {route.prefix}{subroute.path}")