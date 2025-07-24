#!/usr/bin/env tsx

/**
 * RAG System Initialization Script
 * 
 * This script initializes the vector database and populates it with sample
 * knowledge base content for each agent type.
 */

import { initializeVectorDatabase, VectorStoreFactory } from '../src/mastra/rag/vector-store';
import { simpleDocumentProcessor } from '../src/mastra/rag/simple-document-processor';
import { INDEX_CONFIG } from '../src/mastra/rag/config';

// Sample knowledge base content for each agent
const SAMPLE_DATA = {
  weather: [
    {
      content: `# Weather Activities Guide

## Sunny Weather Activities (Temperature 20-30°C)
Perfect conditions for outdoor activities:
- Beach visits and swimming
- Hiking and nature walks
- Picnics in parks
- Outdoor sports (tennis, football, cycling)
- Gardening and outdoor photography
- Barbecues and outdoor dining

Safety tips: Use sunscreen, stay hydrated, wear light clothing.`,
      type: 'markdown' as const,
      metadata: {
        category: 'weather',
        temperature_range: '20-30',
        weather_type: 'sunny',
        activity_type: 'outdoor',
      },
    },
    {
      content: `# Rainy Day Indoor Activities

## When it's raining heavily
Great indoor activities to stay entertained:
- Visit museums and art galleries
- Indoor rock climbing or gym workouts
- Shopping at malls or markets
- Movie theaters and entertainment centers
- Cooking new recipes
- Reading in cozy cafes
- Board games and puzzles
- Indoor swimming pools

Tips: Check weather forecasts, carry umbrellas when venturing out.`,
      type: 'markdown' as const,
      metadata: {
        category: 'weather',
        weather_type: 'rainy',
        activity_type: 'indoor',
      },
    },
    {
      content: `# Cold Weather Activities (Temperature Below 10°C)

## Winter and cold weather fun:
- Ice skating and winter sports
- Hot chocolate and warm cafes
- Indoor activities like museums
- Cozy movie nights at home
- Winter hiking with proper gear
- Visit thermal springs or spas
- Indoor markets and shopping
- Hot soup restaurants

Preparation: Layer clothing, wear appropriate footwear, check road conditions.`,
      type: 'markdown' as const,
      metadata: {
        category: 'weather',
        temperature_range: '<10',
        weather_type: 'cold',
        activity_type: 'mixed',
      },
    },
    {
      content: `# Weather Safety Guidelines

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
      type: 'markdown' as const,
      metadata: {
        category: 'weather',
        topic: 'safety',
        importance: 'high',
      },
    },
  ],

  eightball: [
    {
      content: `# The Ancient Wisdom of the Magic Eight Ball

## Origins and Mystical Significance
The magic eight ball draws from ancient divination traditions, combining the mystical properties of the sphere with the power of random cosmic forces. Each response is believed to channel universal energies.

## Understanding Your Reading
- Positive responses indicate favorable cosmic alignment
- Negative responses suggest caution and reflection
- Neutral responses encourage patience and clarity
- "Ask again later" means the universe needs more time

## Spiritual Interpretation
Trust your intuition when interpreting readings. The eight ball serves as a mirror to your inner wisdom, helping you connect with your subconscious knowledge.`,
      type: 'markdown' as const,
      metadata: {
        category: 'wisdom',
        topic: 'interpretation',
        mystical_level: 'high',
      },
    },
    {
      content: `# Meditation and Mindfulness for Decision Making

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
      type: 'markdown' as const,
      metadata: {
        category: 'guidance',
        topic: 'meditation',
        practice_type: 'mindfulness',
      },
    },
    {
      content: `# Fortune Telling Traditions

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
      type: 'markdown' as const,
      metadata: {
        category: 'fortune',
        tradition: 'global',
        time_period: 'ancient_modern',
      },
    },
  ],

  quotes: [
    {
      content: `# Inspirational Quotes About Resilience

## Overcoming Challenges
"The greatest glory in living lies not in never falling, but in rising every time we fall." - Nelson Mandela

"It is during our darkest moments that we must focus to see the light." - Aristotle

"Success is not final, failure is not fatal: it is the courage to continue that counts." - Winston Churchill

## Building Inner Strength
"You have power over your mind - not outside events. Realize this, and you will find strength." - Marcus Aurelius

"What lies behind us and what lies before us are tiny matters compared to what lies within us." - Ralph Waldo Emerson

These words remind us that resilience comes from within, and every setback is an opportunity to grow stronger.`,
      type: 'markdown' as const,
      metadata: {
        category: 'inspiration',
        theme: 'resilience',
        authors: ['Nelson Mandela', 'Aristotle', 'Winston Churchill', 'Marcus Aurelius', 'Ralph Waldo Emerson'],
      },
    },
    {
      content: `# Quotes About Success and Achievement

## Defining Success
"Success is liking yourself, liking what you do, and liking how you do it." - Maya Angelou

"Your time is limited, don't waste it living someone else's life." - Steve Jobs

"The only way to do great work is to love what you do." - Steve Jobs

## Achieving Goals
"A goal is not always meant to be reached, it often serves simply as something to aim at." - Bruce Lee

"The future belongs to those who believe in the beauty of their dreams." - Eleanor Roosevelt

"Don't watch the clock; do what it does. Keep going." - Sam Levenson

True success is about authenticity, passion, and persistence in pursuing what matters to you.`,
      type: 'markdown' as const,
      metadata: {
        category: 'motivation',
        theme: 'success',
        authors: ['Maya Angelou', 'Steve Jobs', 'Bruce Lee', 'Eleanor Roosevelt', 'Sam Levenson'],
      },
    },
    {
      content: `# Wisdom About Life and Happiness

## Living Fully
"The purpose of our lives is to be happy." - Dalai Lama

"Life is what happens to you while you're busy making other plans." - John Lennon

"In the end, we will remember not the words of our enemies, but the silence of our friends." - Martin Luther King Jr.

## Finding Joy
"Happiness is not something ready made. It comes from your own actions." - Dalai Lama

"The best time to plant a tree was 20 years ago. The second best time is now." - Chinese Proverb

"Yesterday is history, tomorrow is a mystery, today is a gift." - Eleanor Roosevelt

Life's wisdom teaches us to find joy in the present moment and meaning in our connections with others.`,
      type: 'markdown' as const,
      metadata: {
        category: 'wisdom',
        theme: 'happiness',
        authors: ['Dalai Lama', 'John Lennon', 'Martin Luther King Jr.', 'Eleanor Roosevelt'],
        cultural_origin: ['Tibetan', 'Western', 'Chinese'],
      },
    },
  ],
};

async function populateKnowledgeBase() {
  console.log('🚀 Starting RAG system initialization...\n');
  
  try {
    // Step 1: Initialize vector database
    console.log('📊 Initializing vector database indexes...');
    await initializeVectorDatabase();
    
    // Step 2: Process and store sample data for each agent
    for (const [agentType, documents] of Object.entries(SAMPLE_DATA)) {
      console.log(`\n📚 Processing ${agentType} knowledge base...`);
      
      const indexName = INDEX_CONFIG.indexes[agentType as keyof typeof INDEX_CONFIG.indexes];
      if (!indexName) {
        console.warn(`⚠️  No index configured for agent type: ${agentType}`);
        continue;
      }
      
      // Process documents in batch (simplified for testing)
      const results = await simpleDocumentProcessor.processBatch(
        documents.map(doc => ({
          content: doc.content,
          metadata: doc.metadata,
        })),
        indexName,
        {
          agentType: agentType as keyof typeof SAMPLE_DATA,
          customMetadata: {
            source: 'initial_knowledge_base',
            processed_at: new Date().toISOString(),
          },
        }
      );
      
      console.log(`✅ Processed ${results.length} documents for ${agentType}`);
      
      // Log processing statistics
      const totalChunks = results.reduce((sum, doc) => sum + doc.totalChunks, 0);
      const totalTokens = results.reduce((sum, doc) => sum + doc.totalTokens, 0);
      const avgProcessingTime = results.reduce((sum, doc) => sum + doc.processingTime, 0) / results.length;
      
      console.log(`   📈 Stats: ${totalChunks} chunks, ~${totalTokens} tokens, avg ${Math.round(avgProcessingTime)}ms per document`);
    }
    
    console.log('\n🎉 RAG system initialization completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Vector databases initialized for all agent types`);
    console.log(`   - Knowledge base populated with sample content`);
    console.log(`   - Ready for RAG-enhanced agent interactions`);
    
    // Verification step
    console.log('\n🔍 Verifying installation...');
    await verifyRagSystem();
    
  } catch (error) {
    console.error('\n❌ RAG initialization failed:', error);
    process.exit(1);
  }
}

async function verifyRagSystem() {
  try {
    // Test a simple query on each index
    for (const [agentType, indexName] of Object.entries(INDEX_CONFIG.indexes)) {
      const testQuery = getTestQuery(agentType);
      console.log(`   Testing ${agentType} index with query: "${testQuery}"`);
      
      const queryEmbedding = await simpleDocumentProcessor.embedQuery(testQuery);
      const results = await VectorStoreFactory.getInstance().queryVectors({
        indexName,
        queryVector: queryEmbedding,
        topK: 1,
      });
      
      if (results.length > 0) {
        console.log(`   ✅ ${agentType}: Found ${results.length} results (score: ${results[0].score.toFixed(3)})`);
      } else {
        console.log(`   ⚠️  ${agentType}: No results found`);
      }
    }
    
    console.log('\n✅ RAG system verification completed');
    
  } catch (error) {
    console.error('❌ RAG system verification failed:', error);
  }
}

function getTestQuery(agentType: string): string {
  const testQueries = {
    weather: 'outdoor activities sunny day',
    eightball: 'mystical guidance decision making',
    quotes: 'inspirational quotes about success',
    general: 'general knowledge',
  };
  
  return testQueries[agentType as keyof typeof testQueries] || testQueries.general;
}

// Run if called directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  populateKnowledgeBase().catch(console.error);
}

export { populateKnowledgeBase };