"""Test-only synthetic estimators; never overwrite the supplied artifact."""
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from app.risk_model_loader import FEATURES

def write_fixture(path, **changes):
    values=[];targets=[]
    for category,day in [("Low",0),("Medium",5),("High",10)]:
        for _ in range(10):
            values.append([day,28,60,100,150,90,50]);targets.append(category)
    model=RandomForestClassifier(n_estimators=12,max_features=None,random_state=381).fit(pd.DataFrame(values,columns=list(FEATURES)),targets)
    bundle={"model":model,"features":list(FEATURES),"classes":list(model.classes_),"data_origin":"SYNTHETIC_DEMO"}
    bundle.update(changes);joblib.dump(bundle,path);return bundle

VALID={"storage_day":5,"temperature_c":30.5,"humidity_percent":76.0,"weight_g":98.2,"color_r":145,"color_g":90,"color_b":50}
