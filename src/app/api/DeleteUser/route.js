import { NextResponse } from 'next/server';
import { db } from '../../../db';
import jwt from 'jsonwebtoken';

// Enable CORS for preflight requests (OPTIONS)
export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization',
    },
  });
}

// DELETE request for removing a user
export async function DELETE(request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1]; // Extract the token from the Authorization header
    if (!token) {
      return NextResponse.json({ message: 'Authorization token is required' }, { status: 401 });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use your JWT secret
    const userId = decoded.id; // Assuming the token contains the user ID as 'id'

    // Delete user from the database
    const [result] = await db.execute(
      'DELETE FROM users WHERE sr = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: 'User  not found' }, { status: 404 });
    }

    // Return success response
    return NextResponse.json({ message: 'User  deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}