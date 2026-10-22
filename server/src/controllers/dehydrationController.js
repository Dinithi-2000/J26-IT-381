import DehydrationTelemetry
  from "../models/DehydrationTelemetry.js";


// ======================================================
// POST NEW TELEMETRY
// ======================================================

export async function createTelemetry(
  request,
  response,
  next
) {

  try {

    const {
      batchId,
      initialMoisture,
      targetMoisture,
      initialWeight,
      currentWeight,
      targetWeight,
      estimatedMoisture,
      temperature,
      humidity,
      elapsedTime,
      remainingDryingTime,
      heaterState,
      fanState,
      systemState,
      mlStatus
    } = request.body;


    if (!batchId) {

      return response.status(400).json({
        success: false,
        message: "batchId is required"
      });
    }


    const telemetry =
      await DehydrationTelemetry.create({

        batchId,

        initialMoisture,
        targetMoisture,

        initialWeight,
        currentWeight,
        targetWeight,

        estimatedMoisture,

        temperature,
        humidity,

        elapsedTime,
        remainingDryingTime,

        heaterState,
        fanState,

        systemState,
        mlStatus
      });


    response.status(201).json({
      success: true,
      message: "Telemetry stored",
      data: telemetry
    });

  }

  catch (error) {
    next(error);
  }
}



// ======================================================
// GET LATEST TELEMETRY
// ======================================================

export async function getLatestTelemetry(
  _request,
  response,
  next
) {

  try {

    const latest =
      await DehydrationTelemetry
        .findOne()
        .sort({ createdAt: -1 })
        .lean();


    if (!latest) {

      return response.status(404).json({
        success: false,
        message: "No dehydration telemetry available"
      });
    }


    response.json({
      success: true,
      data: latest
    });

  }

  catch (error) {
    next(error);
  }
}



// ======================================================
// GET HISTORY FOR ONE BATCH
// ======================================================

export async function getBatchTelemetry(
  request,
  response,
  next
) {

  try {

    const records =
      await DehydrationTelemetry
        .find({
          batchId: request.params.batchId
        })
        .sort({ createdAt: 1 })
        .lean();


    response.json({
      success: true,
      count: records.length,
      data: records
    });

  }

  catch (error) {
    next(error);
  }
}