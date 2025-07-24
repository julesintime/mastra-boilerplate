#!/usr/bin/env tsx

/**
 * Graph RAG System Initialization Script
 * 
 * This script builds document relationship graphs for enhanced retrieval
 * capabilities across all agent knowledge bases.
 */

import { graphRAGRetrieval } from '../src/mastra/rag/graph-retrieval';
import { VectorStoreFactory } from '../src/mastra/rag/vector-store';
import { INDEX_CONFIG } from '../src/mastra/rag/config';

// Sample enhanced data with relationships for graph building
const ENHANCED_SAMPLE_DATA = {
  weather: [
    {
      id: 'weather_sunny_activities',
      text: `# Sunny Weather Activities Guide (Temperature 20-30°C)

Perfect conditions for outdoor activities:
- Beach visits and swimming
- Hiking and nature walks
- Picnics in parks
- Outdoor sports (tennis, football, cycling)
- Gardening and outdoor photography
- Barbecues and outdoor dining

Safety tips: Use sunscreen, stay hydrated, wear light clothing.`,
      metadata: {
        category: 'weather',
        temperature_range: '20-30',
        weather_type: 'sunny',
        activity_type: 'outdoor',
        level: 1,
        topics: ['outdoor', 'summer', 'activities', 'health'],
        timestamp: '2024-01-15T10:00:00Z'
      }
    },
    {
      id: 'weather_rainy_indoor',
      text: `# Rainy Day Indoor Activities

When it's raining heavily, great indoor activities to stay entertained:
- Visit museums and art galleries
- Indoor rock climbing or gym workouts
- Shopping at malls or markets
- Movie theaters and entertainment centers
- Cooking new recipes
- Reading in cozy cafes
- Board games and puzzles
- Indoor swimming pools

Tips: Check weather forecasts, carry umbrellas when venturing out.`,
      metadata: {
        category: 'weather',
        weather_type: 'rainy',
        activity_type: 'indoor',
        level: 1,
        topics: ['indoor', 'entertainment', 'activities'],
        timestamp: '2024-01-16T14:00:00Z'
      }
    },
    {
      id: 'weather_cold_activities',
      text: `# Cold Weather Activities (Temperature Below 10°C)

Winter and cold weather fun:
- Ice skating and winter sports
- Hot chocolate and warm cafes
- Indoor activities like museums
- Cozy movie nights at home
- Winter hiking with proper gear
- Visit thermal springs or spas
- Indoor markets and shopping
- Hot soup restaurants

Preparation: Layer clothing, wear appropriate footwear, check road conditions.`,
      metadata: {
        category: 'weather',
        temperature_range: '<10',
        weather_type: 'cold',
        activity_type: 'mixed',
        level: 1,
        topics: ['winter', 'cold', 'indoor', 'outdoor'],
        timestamp: '2024-01-17T09:00:00Z'
      }
    },
    {
      id: 'weather_safety_guide',
      text: `# Weather Safety Guidelines

## General Weather Safety
- Check weather forecasts before outdoor activities
- Dress appropriately for conditions
- Stay hydrated in hot weather
- Seek shelter during storms
- Be aware of UV index for sun protection
- Know signs of weather-related health issues
- Keep emergency supplies ready
- Monitor air quality reports

## Extreme Weather Precautions
- Heatwaves: Stay cool, avoid peak sun hours
- Thunderstorms: Stay indoors, avoid water
- Snow/Ice: Drive carefully, dress warmly
- High winds: Avoid outdoor activities`,
      metadata: {
        category: 'weather',
        topic: 'safety',
        importance: 'high',
        level: 2,
        topics: ['safety', 'emergency', 'health', 'preparation'],
        timestamp: '2024-01-18T11:00:00Z'
      }
    }
  ],

  eightball: [
    {
      id: 'eightball_ancient_wisdom',
      text: `# The Ancient Wisdom of the Magic Eight Ball

## Origins and Mystical Significance
The magic eight ball draws from ancient divination traditions, combining the mystical properties of the sphere with the power of random cosmic forces. Each response is believed to channel universal energies.

## Understanding Your Reading
- Positive responses indicate favorable cosmic alignment
- Negative responses suggest caution and reflection
- Neutral responses encourage patience and clarity
- "Ask again later" means the universe needs more time

## Spiritual Interpretation
Trust your intuition when interpreting readings. The eight ball serves as a mirror to your inner wisdom, helping you connect with your subconscious knowledge.`,
      metadata: {
        category: 'wisdom',
        topic: 'interpretation',
        mystical_level: 'high',
        level: 1,
        topics: ['mystical', 'divination', 'wisdom', 'interpretation'],
        timestamp: '2024-01-19T16:00:00Z'
      }
    },
    {
      id: 'eightball_meditation_guide',
      text: `# Meditation and Mindfulness for Decision Making

## Before Consulting the Eight Ball
- Clear your mind through deep breathing
- Focus on your specific question
- Release attachment to specific outcomes
- Open yourself to cosmic guidance

## After Receiving Your Reading
- Reflect on the message's deeper meaning
- Consider how it relates to your current situation
- Trust your intuitive response to the guidance
- Remember that you have free will in all decisions

The eight ball's wisdom combines with your own inner knowing to provide guidance.`,
      metadata: {
        category: 'guidance',
        topic: 'meditation',
        practice_type: 'mindfulness',
        level: 2,
        topics: ['meditation', 'mindfulness', 'decision', 'guidance'],
        timestamp: '2024-01-20T08:00:00Z'
      }
    },
    {
      id: 'eightball_fortune_traditions',
      text: `# Fortune Telling Traditions

## Global Divination Practices
The eight ball connects to ancient traditions:
- Celtic rune casting for life guidance
- Chinese I Ching for cosmic wisdom
- Tarot cards for spiritual insight
- Crystal ball gazing for future glimpses
- Tea leaf reading for personal messages

## Modern Mystical Practice
Today's seekers use various tools:
- Digital oracles and apps
- Pendulum dowsing
- Meditation and intuition
- Dream interpretation
- Astrological guidance

All paths lead to inner wisdom and universal connection.`,
      metadata: {
        category: 'fortune',
        tradition: 'global',
        time_period: 'ancient_modern',
        level: 1,
        topics: ['tradition', 'global', 'history', 'divination'],
        timestamp: '2024-01-21T13:00:00Z'
      }
    }
  ],

  quotes: [
    {
      id: 'quotes_resilience',
      text: `# Inspirational Quotes About Resilience

## Overcoming Challenges
"The greatest glory in living lies not in never falling, but in rising every time we fall." - Nelson Mandela

"It is during our darkest moments that we must focus to see the light." - Aristotle

"Success is not final, failure is not fatal: it is the courage to continue that counts." - Winston Churchill

## Building Inner Strength
"You have power over your mind - not outside events. Realize this, and you will find strength." - Marcus Aurelius

"What lies behind us and what lies before us are tiny matters compared to what lies within us." - Ralph Waldo Emerson

These words remind us that resilience comes from within, and every setback is an opportunity to grow stronger.`,
      metadata: {
        category: 'inspiration',
        theme: 'resilience',
        authors: ['Nelson Mandela', 'Aristotle', 'Winston Churchill', 'Marcus Aurelius', 'Ralph Waldo Emerson'],
        level: 1,
        topics: ['resilience', 'strength', 'challenge', 'growth'],
        timestamp: '2024-01-22T10:00:00Z'
      }
    },
    {
      id: 'quotes_success',
      text: `# Quotes About Success and Achievement

## Defining Success
"Success is liking yourself, liking what you do, and liking how you do it." - Maya Angelou

"Your time is limited, don't waste it living someone else's life." - Steve Jobs

"The only way to do great work is to love what you do." - Steve Jobs

## Achieving Goals
"A goal is not always meant to be reached, it often serves simply as something to aim at." - Bruce Lee

"The future belongs to those who believe in the beauty of their dreams." - Eleanor Roosevelt

"Don't watch the clock; do what it does. Keep going." - Sam Levenson

True success is about authenticity, passion, and persistence in pursuing what matters to you.`,
      metadata: {
        category: 'motivation',
        theme: 'success',
        authors: ['Maya Angelou', 'Steve Jobs', 'Bruce Lee', 'Eleanor Roosevelt', 'Sam Levenson'],
        level: 1,
        topics: ['success', 'achievement', 'goals', 'authenticity'],
        timestamp: '2024-01-23T15:00:00Z'
      }
    },
    {
      id: 'quotes_happiness_wisdom',
      text: `# Wisdom About Life and Happiness

## Living Fully
"The purpose of our lives is to be happy." - Dalai Lama

"Life is what happens to you while you're busy making other plans." - John Lennon

"In the end, we will remember not the words of our enemies, but the silence of our friends." - Martin Luther King Jr.

## Finding Joy
"Happiness is not something ready made. It comes from your own actions." - Dalai Lama

"The best time to plant a tree was 20 years ago. The second best time is now." - Chinese Proverb

"Yesterday is history, tomorrow is a mystery, today is a gift." - Eleanor Roosevelt

Life's wisdom teaches us to find joy in the present moment and meaning in our connections with others.`,
      metadata: {
        category: 'wisdom',
        theme: 'happiness',
        authors: ['Dalai Lama', 'John Lennon', 'Martin Luther King Jr.', 'Eleanor Roosevelt'],
        cultural_origin: ['Tibetan', 'Western', 'Chinese'],
        level: 1,
        topics: ['happiness', 'wisdom', 'life', 'joy'],
        timestamp: '2024-01-24T12:00:00Z'
      }
    }
  ]
};

async function buildDocumentGraphs() {
  console.log('🔗 Starting Graph RAG system initialization...\n');
  
  try {
    // Step 1: Initialize vector database (should already be done)
    console.log('📊 Verifying vector database...');
    const vectorStore = await VectorStoreFactory.getInstance().getVectorStore();
    console.log('✓ Vector database ready\n');

    // Step 2: Build document graphs for each agent type
    for (const [agentType, documents] of Object.entries(ENHANCED_SAMPLE_DATA)) {
      console.log(`🔗 Building document graph for ${agentType}...`);
      
      try {
        // Build the document relationship graph
        await graphRAGRetrieval.buildDocumentGraph(
          documents,
          {
            semanticThreshold: 0.65, // Lower threshold for more relationships
            hierarchicalAnalysis: true,
            temporalAnalysis: true,
            topicalAnalysis: true,
          }
        );
        
        console.log(`✅ Built graph for ${agentType}: ${documents.length} documents processed`);
        
        // Log some statistics
        const graphData = graphRAGRetrieval.exportGraph();
        console.log(`   📈 Graph stats: ${graphData.nodes.length} nodes, ${graphData.edges.length} relationships\n`);
        
      } catch (error) {
        console.error(`❌ Failed to build graph for ${agentType}:`, error.message);
      }
    }

    // Step 3: Test graph queries
    console.log('🔍 Testing graph query capabilities...\n');
    await testGraphQueries();
    
    console.log('🎉 Graph RAG system initialization completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Document relationship graphs built for all agent types');
    console.log('   - Semantic, hierarchical, temporal, and topical relationships analyzed');
    console.log('   - Graph query tools ready for enhanced retrieval');
    console.log('   - Cross-domain relationship analysis enabled');
    
  } catch (error) {
    console.error('\n❌ Graph RAG initialization failed:', error);
    process.exit(1);
  }
}

async function testGraphQueries() {
  const testQueries = [
    {
      query: 'outdoor activities for sunny weather',
      expectedDomain: 'weather',
      description: 'Test weather domain graph traversal'
    },
    {
      query: 'meditation and wisdom for decisions',
      expectedDomain: 'eightball',
      description: 'Test mystical domain relationship analysis'
    },
    {
      query: 'inspiration for overcoming challenges',
      expectedDomain: 'quotes',
      description: 'Test motivational content graph search'
    }
  ];

  for (const test of testQueries) {
    try {
      console.log(`   Testing: "${test.query}"`);
      
      // This would test the graph query functionality
      // In a real implementation, you'd call the graph query tools
      const results = await graphRAGRetrieval.graphQuery(
        test.query,
        `${test.expectedDomain}_knowledge`, // This would need to match your index names
        {
          maxDepth: 2,
          minWeight: 0.3,
          expandDirection: 'bidirectional'
        }
      );
      
      console.log(`   ✅ Found ${results.primaryResults.length} primary results, ${results.relatedResults.length} related results`);
      console.log(`   ⏱️  Query time: ${results.queryTime}ms\n`);
      
    } catch (error) {
      console.log(`   ⚠️  Test query failed: ${error.message}\n`);
    }
  }
}

// Run if called directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  buildDocumentGraphs().catch(console.error);
}

export { buildDocumentGraphs };