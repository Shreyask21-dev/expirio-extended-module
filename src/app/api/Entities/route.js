import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '../../../db';

// Enable CORS for preflight requests (OPTIONS)
export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// GET request to fetch entities with user details (username) from the database with Bearer token
export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token from Authorization header
    const token = authHeader.split(' ')[1];

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Query the database to fetch entities with the username by joining 'users' and 'entities'
    const [rows] = await db.execute(
      `SELECT entities.*, users.username, users.sr AS user_id
       FROM entities
       JOIN users ON entities.user_id = users.sr
       WHERE users.sr = ?`,
      [decoded.user_id]
    );

    // Check if there are entities
    if (rows.length === 0) {
      return NextResponse.json({ message: 'No entities found' }, { status: 404 });
    }

    // Send success response with fetched entities and user details
    return NextResponse.json({
      message: 'Entities fetched successfully',
      data: rows,
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}


// POST request to create a new entity
export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Parse the request body
    const body = await request.json();
    const {
      entity_name,
      entity_desc,
      entity_short_desc,
      category,
    } = body;

    // Validate required fields
    if (!entity_name || !entity_desc || !entity_short_desc || !category) {
      return NextResponse.json(
        { message: 'Missing required fields: entity_name, entity_desc, entity_short_desc, and category are mandatory.' },
        { status: 400 }
      );
    }

    // Validate category
    if (!['income', 'expense'].includes(category.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid category. Allowed values are "income" or "expense".' },
        { status: 400 }
      );
    }

    // Insert the new entity into the database
    const [result] = await db.execute(
      `INSERT INTO entities (user_id, entity_name, entity_desc, entity_short_desc, category)
       VALUES (?, ?, ?, ?, ?)`,
      [decoded.user_id, entity_name, entity_desc, entity_short_desc, category.toLowerCase()]
    );

    // Return success response
    return NextResponse.json(
      {
        message: 'Entity created successfully',
        data: {
          id: result.insertId,
          user_id: decoded.user_id,
          entity_name,
          entity_desc,
          entity_short_desc,
          category: category.toLowerCase(),
        },
      },
      {
        status: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}


export async function PUT(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user_id = decoded.user_id; // Extract user_id from the JWT

    // Parse the request body
    const body = await request.json();
    const {
      id, // ID of the entity to update
      entity_name,
      entity_desc,
      entity_short_desc,
      category
    } = body;

    // Validate required fields
    if (!id || !entity_name || !entity_desc || !entity_short_desc) {
      return NextResponse.json(
        { message: 'Missing required fields: id, entity_name, entity_desc, and entity_short_desc are mandatory.' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (category && !['income', 'expense'].includes(category.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid category. Allowed values are "income" or "expense".' },
        { status: 400 }
      );
    }

    // Check if the entity exists and belongs to the user
    const [existingEntity] = await db.execute(
      `SELECT * FROM entities WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, user_id]
    );

    if (existingEntity.length === 0) {
      return NextResponse.json(
        { message: 'Entity not found or does not belong to the user.' },
        { status: 404 }
      );
    }

    // Update the entity in the database
    await db.execute(
      `UPDATE entities
       SET entity_name = ?,
           entity_desc = ?,
           entity_short_desc = ?,
           category = ?
       WHERE id = ? AND user_id = ?`,
      [
        entity_name || existingEntity[0].entity_name,
        entity_desc || existingEntity[0].entity_desc,
        entity_short_desc || existingEntity[0].entity_short_desc,
        category ? category.toLowerCase() : existingEntity[0].category,
        id,
        user_id
      ]
    );

    // Return success response
    return NextResponse.json(
      { message: 'Entity updated successfully' },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}


export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user_id;

    const body = await request.json();
    const { entity_id } = body;

    if (!entity_id) {
      return NextResponse.json({ message: 'Entity ID is required' }, { status: 400 });
    }

    // Check if the entity belongs to the user
    const [[entity]] = await db.execute(
      'SELECT id FROM entities WHERE id = ? AND user_id = ? LIMIT 1',
      [entity_id, userId]
    );

    if (!entity) {
      return NextResponse.json({ message: 'Entity not found or not authorized.' }, { status: 404 });
    }

    // Delete the entity (ON DELETE CASCADE handles related records)
    await db.execute('DELETE FROM entities WHERE id = ?', [entity_id]);

    return NextResponse.json({ message: 'Entity and related records deleted successfully.' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}

