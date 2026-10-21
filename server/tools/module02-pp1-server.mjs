import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createModule02Router} from '../src/module02/routes.js';
import {createRiskRouter} from '../src/module02-risk/routes.js';
import {PP1_URI, verifyPp1Target, verifyPp1Connection} from '../src/module02/pp1Dataset.js';
import {SyntheticRiskPrediction} from '../src/module02-risk/model.js';

// Secrets retain existing conventions; database target NEVER comes from .env.
dotenv.config({path:fileURLToPath(new URL('../.env', import.meta.url)),quiet:true});
const {values} = parseArgs({options:{uri:{type:'string',default:PP1_URI}}});
try {
  verifyPp1Target(values.uri);
  await mongoose.connect(values.uri,{serverSelectionTimeoutMS:5000});
  verifyPp1Connection(); await SyntheticRiskPrediction.init();
  const app = express();
  app.use(cors({origin:['http://localhost:5180','http://127.0.0.1:5180']}));
  app.use(express.json());
  app.get('/api/health',(_req,res)=>res.json({status:'ok',database:mongoose.connection.name,dataset:'PP1_LOCAL_DEVELOPMENT'}));
  app.use('/api/module-02',createRiskRouter({allowIllustrativeHistory:true}));
  app.use('/api',createModule02Router());
  app.use((error,_req,res,_next)=>res.status(400).json({error:{code:'INVALID_REQUEST',message:'Invalid presentation API request.'}}));
  app.listen(5002,'127.0.0.1',()=>console.log('Module 02 PP1 API: http://127.0.0.1:5002/api (local development database only)'));
} catch(error) {console.error('PP1 API refused or unavailable:',error.name);await mongoose.disconnect();process.exitCode=1;}
