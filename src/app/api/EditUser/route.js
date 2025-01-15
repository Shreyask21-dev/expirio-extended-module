import { NextResponse } from 'next/server';
import { db } from '../../../db';
import jwt from 'jsonwebtoken';

// Enable CORS for preflight requests (OPTIONS)
export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// PUT request for updating user fields
export async function PUT(request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1]; // Extract the token from the Authorization header
    if (!token) {
      return NextResponse.json({ message: 'Authorization token is required' }, { status: 401 });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use your JWT secret
    const userId = decoded.id; // Assuming the token contains the user ID as 'id'

    const { name, email, phone, username, password } = await request.json();

    // Check for username conflicts
    const [existingUser ] = await db.execute(
      'SELECT * FROM users WHERE username = ? AND sr != ?',
      [username, userId]
    );

    if (existingUser .length > 0) {
      return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
    }

    // Update user fields in the database
    const [result] = await db.execute(
      'UPDATE users SET name = ?, email = ?, phone = ?, username = ?, password = ? WHERE sr = ?',
      [name, email, phone, username, password, userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: 'User  not found or no changes made' }, { status: 404 });
    }

    // Return success response
    return NextResponse.json({ message: 'User  updated successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}