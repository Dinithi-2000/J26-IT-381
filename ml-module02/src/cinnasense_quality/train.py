"""Train a research prototype only after physical-sample and label review."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from .dataset import load_reviewed, split_groups


def train(root, manifest, output, epochs=12, fine_tune_epochs=5, seed=381):
    # Validate first, before downloading ImageNet weights or importing TensorFlow.
    root, output = Path(root).resolve(), Path(output)
    rows = load_reviewed(manifest, root)
    splits = split_groups(rows, seed)
    if (output / "model.keras").exists():
        raise ValueError("Choose a new output directory; existing models are preserved.")
    import numpy as np
    import tensorflow as tf
    from PIL import Image, ImageOps
    from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
    tf.keras.utils.set_random_seed(seed)
    output.mkdir(parents=True, exist_ok=True)
    classes = sorted({row["label"] for row in rows})
    for name, subset in splits.items():
        with (output / f"{name}.csv").open("w",encoding="utf-8",newline="") as stream:
            writer=csv.DictWriter(stream,fieldnames=list(subset[0]));writer.writeheader();writer.writerows(subset)
    def load(subset):
        arrays=[]
        for row in subset:
            with Image.open(root / row["image_path"]) as image:
                if image.width*image.height > 20000000: raise ValueError("Image exceeds pixel limit.")
                arrays.append(np.asarray(ImageOps.exif_transpose(image).convert("RGB").resize((224,224),Image.Resampling.BILINEAR),dtype=np.float32))
        return np.stack(arrays),np.asarray([classes.index(row["label"]) for row in subset])
    x_train,y_train=load(splits["train"]);x_val,y_val=load(splits["validation"])
    augmentation=tf.keras.Sequential([tf.keras.layers.RandomFlip("horizontal"),tf.keras.layers.RandomRotation(.04)])
    base=tf.keras.applications.MobileNetV2(input_shape=(224,224,3),include_top=False,weights="imagenet")
    base.trainable=False
    inputs=tf.keras.Input((224,224,3)); x=augmentation(inputs)
    # Same MobileNetV2 [-1,1] input scaling is embedded for training and serving.
    x=tf.keras.layers.Rescaling(1/127.5,offset=-1)(x);x=base(x,training=False)
    x=tf.keras.layers.GlobalAveragePooling2D()(x);x=tf.keras.layers.Dropout(.3)(x)
    outputs=tf.keras.layers.Dense(len(classes),activation="softmax")(x)
    model=tf.keras.Model(inputs,outputs)
    weights={i:len(y_train)/(len(classes)*int((y_train==i).sum())) for i in range(len(classes))}
    def callbacks(): return [tf.keras.callbacks.EarlyStopping(monitor="val_loss",patience=3,restore_best_weights=True),tf.keras.callbacks.TerminateOnNaN()]
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3),loss="sparse_categorical_crossentropy",metrics=["accuracy"])
    history=model.fit(x_train,y_train,validation_data=(x_val,y_val),epochs=epochs,batch_size=16,class_weight=weights,callbacks=callbacks())
    # Compare fine tuning on validation only; test images stay unseen until the final evaluation.
    best_loss=float(model.evaluate(x_val,y_val,verbose=0)[0]); best_weights=model.get_weights()
    if fine_tune_epochs:
        base.trainable=True
        for layer in base.layers[:-20]: layer.trainable=False
        for layer in base.layers:
            if isinstance(layer,tf.keras.layers.BatchNormalization): layer.trainable=False
        model.compile(optimizer=tf.keras.optimizers.Adam(1e-5),loss="sparse_categorical_crossentropy",metrics=["accuracy"])
        model.fit(x_train,y_train,validation_data=(x_val,y_val),epochs=fine_tune_epochs,batch_size=16,class_weight=weights,callbacks=callbacks())
        if float(model.evaluate(x_val,y_val,verbose=0)[0]) > best_loss: model.set_weights(best_weights)
    x_test,y_test=load(splits["test"]); scores=model.predict(x_test,verbose=0); predicted=scores.argmax(axis=1)
    report={"accuracy":float(accuracy_score(y_test,predicted)),"classification_report":classification_report(y_test,predicted,labels=list(range(len(classes))),target_names=classes,output_dict=True,zero_division=0),"confusion_matrix":confusion_matrix(y_test,predicted,labels=list(range(len(classes)))).tolist(),"classes":classes,
      "split_counts":{name:len(subset) for name,subset in splits.items()},"sample_counts":{name:len({row["sample_id"] for row in subset}) for name,subset in splits.items()},"seed":seed,
      "limitations":["Small research prototype; not a validated safety, mold-confirmation or degradation-risk model.","Test score is conditional on reviewed physical sample IDs and labels.","ESP32-CAM domain performance needs a separate held-out capture set.","Softmax scores are not calibrated confidence."]}
    model.save(output / "model.keras")
    (output / "evaluation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    metadata={"model_version":output.resolve().name,"classes":classes,"input_size":[224,224],"preprocessing":"embedded_mobilenet_v2_minus1_to1","model_sha256":hashlib.sha256((output/"model.keras").read_bytes()).hexdigest(),"prototype":True,"evaluation_file":"evaluation.json","trained_at":__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
    (output / "metadata.json").write_text(json.dumps(metadata,indent=2),encoding="utf-8")
    (output / "training_history.json").write_text(json.dumps(history.history,indent=2),encoding="utf-8")
    return report

if __name__ == "__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--root",required=True);parser.add_argument("--manifest",required=True);parser.add_argument("--output",required=True);parser.add_argument("--epochs",type=int,default=12);parser.add_argument("--fine-tune-epochs",type=int,default=5)
    args=parser.parse_args()
    if args.epochs<1 or args.fine_tune_epochs<0: parser.error("Invalid epoch count.")
    print(json.dumps(train(args.root,args.manifest,args.output,args.epochs,args.fine_tune_epochs),indent=2))
