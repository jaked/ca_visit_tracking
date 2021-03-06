# [START gae_python37_app]
import os
import pathlib
import sys
import traceback

import yaml
from flask import Flask, redirect, render_template
from google.cloud import storage


app = Flask(__name__, static_url_path="", static_folder="static")
app_state = {
    "maps_api_key": "",
    "foursquare_data_url": ""
}


def error(message):
    print(message, file=sys.stderr)


@app.route("/")
def root():
    return redirect("/index.html")


@app.route("/index.html")
def index():
    return render_template("statelist.html", maps_api_key=app_state["maps_api_key"])


@app.route("/render_data.js")
def render_data_js():
    return render_template("render_data.js", foursquare_data_url=app_state["foursquare_data_url"])


@app.route("/categories.js")
def categories_js():
    return render_template("categories.js", foursquare_data_url=app_state["foursquare_data_url"])


@app.route("/counties/<counties>")
def bycounties(counties):
    return render_template("index.html", counties=counties, venues="")


@app.route("/venues/<venues>")
def byvenues(venues):
    return render_template("index.html", counties="", venues=venues)


@app.route("/bydate.html")
def bydate():
    return render_template("bydate.html", state="", counties="", venues="")


@app.route("/bydatesel/<state>")
def bydateselstate(state):
    return render_template("bydate.html", state=state, counties="", venues="")


@app.route("/bydatesel/<state>/<counties>/<venues>")
def bydatesel(state, counties, venues):
    return render_template("bydate.html", state=state, counties=counties, venues=venues)


@app.route("/allstate.html")
def bystate():
    return render_template("allstate.html", state="ALL", venues="ALL")


@app.route("/bystatesel/<state>")
def bystateselstate(state):
    return render_template("allstate.html", state=state, venues="")


@app.route("/bystatesel/<state>/<venues>")
def bystatesel(state, venues):
    return render_template("allstate.html", state=state, venues=venues)


@app.route("/faq")
def faq():
    return render_template("faq.html", maps_api_key=app_state["maps_api_key"])


@app.route("/nonav")
def nonav():
    return render_template(maps_api_key=appstate["maps_api_key"])


@app.route("/data/<path:path>")
def data(path):
    return redirect("//data.visitdata.org/processed/vendor/foursquare/"
                    f"asof/{app_state['foursquare_data_version']}/" + path, code=302)



def page_not_found(e):
    return render_template('404.html'), 404


def _init_maps_api_key():
    if os.getenv("GAE_ENV", "").startswith("standard"):
        # Production in the standard environment
        try:
            project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
            project_bucket = f"{project_id}.appspot.com"
            storage_client = storage.Client()
            bucket = storage_client.bucket(project_bucket)
            blob = bucket.blob("secrets/maps_api_key")
            maps_api_key = blob.download_as_string().decode("utf-8").rstrip()
        except IOError:
            traceback.print_exc(file=sys.stderr)
            maps_api_key = ""
    else:
        # Local execution.
        maps_api_key = os.getenv("MAPS_API_KEY", "")

    if maps_api_key == "":
        error("Could not retrieve API key. Disabling Google Maps API.")

    app_state["maps_api_key"] = maps_api_key


def _init_data_env():
    if "FOURSQUARE_DATA_VERSION" in os.environ:
        foursquare_data_version = os.getenv("FOURSQUARE_DATA_VERSION")
    else:
        # read from app.yaml
        app_yaml_file = pathlib.Path(__file__).parent.absolute() / "app.yaml"
        with open(app_yaml_file) as f:
            app_yaml_obj = yaml.safe_load(f)
            foursquare_data_version = app_yaml_obj["env_variables"]["FOURSQUARE_DATA_VERSION"]
    app_state["foursquare_data_url"] =\
        f"//data.visitdata.org/processed/vendor/foursquare/asof/{foursquare_data_version}"


def _init():
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 60
    app.register_error_handler(404, page_not_found)
    _init_maps_api_key()
    _init_data_env()
    print(app_state)


_init()


if __name__ == "__main__":
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    app.run(host="127.0.0.1", port=8080, debug=True)
# [END gae_python37_app]
