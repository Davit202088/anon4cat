# Premium Tier Management System

## Overview
Complete premium tier management system with admin panel for drugru.ru application.

## Features Implemented

### 1. Database Schema
- **users** table with role support (user/admin)
- **subscriptions** table tracking tier and expiration
- **admin_actions** table for audit logging

### 2. API Endpoints
- GET /api/admin/users - List all users (admin only)
- POST /api/admin/update-subscription - Set user tier (admin only)
- GET /api/subscription/{userId} - Get user subscription status

### 3. Admin Panel (cabinet.html)
- User list with search functionality
- Quick tier assignment modal
- Statistics dashboard
- Real-time status updates

### 4. Frontend Integration
- Premium badge display for premium users
- Automatic subscription status check on app load
- Visual indicators for premium features

## Configuration

### Set Admin IDs
Edit ecosystem.config.js:


### Available Tiers
- free (default)
- premium_1month (30 days)
- premium_3month (90 days)  
- premium_6month (180 days)

## Usage Examples

### Get all users
curl http://localhost:3000/api/admin/users?adminId=123456789

### Set user to premium
curl -X POST http://localhost:3000/api/admin/update-subscription   -H Content-Type: application/json   -d '{adminId:123456789,userId:111111111,tier:premium_1month,daysValid:30}'

### Check subscription status
curl http://localhost:3000/api/subscription/111111111

## Files Modified
- server.js - Added premium management endpoints
- public/index.html - Added CSS for premium badge
- public/script.js - Added subscription status loading
- ecosystem.config.js - Added ADMIN_IDS configuration

## Status
✅ Complete and tested
✅ Deployed to production
✅ All API endpoints working
✅ Admin panel functional
