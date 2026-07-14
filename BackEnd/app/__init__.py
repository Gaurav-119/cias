import os

from flask import Flask, jsonify

from .config import Config
from .extensions import db, migrate, cors
from .startup import check_ai_service, log_startup_configuration
from .storage import init_storage


def create_app(config_object: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"].split(",")}},
        supports_credentials=True,
    )

    # Storage layer
    try:
        storage = init_storage(app)
        active_provider = storage.provider_name
    except Exception as exc:
        app.logger.warning("Storage init warning: %s", exc)
        active_provider = app.config.get("STORAGE_PROVIDER", "unknown")

    log_startup_configuration(app, active_provider)

    try:
        check_ai_service(app)
    except Exception as exc:
        app.logger.warning("AI service check warning: %s", exc)

    # Import models
    from . import models  # noqa: F401

    from .services.vehicle_master_bootstrap import bootstrap_vehicle_master_catalog

    try:
        bootstrap_vehicle_master_catalog(app)
    except Exception as exc:
        app.logger.warning("Vehicle Master bootstrap warning: %s", exc)

    from scripts.ensure_repair_master import ensure_repair_master_schema

    try:
        with app.app_context():
            ensure_repair_master_schema()
    except Exception as exc:
        app.logger.warning("Repair master bootstrap warning: %s", exc)

    # Blueprints
    from .auth.routes import auth_bp
    from .api.vehicles import vehicles_bp
    from .api.policies import policies_bp
    from .api.claims import claims_bp
    from .api.payments import payments_bp
    from .api.ocr import ocr_bp
    from .api.ai import ai_bp
    from .api.admin import admin_bp
    from .api.agent import agent_bp
    from .api.files import files_bp
    from .api.verification import verification_bp
    from .api.vehicle_master import vehicle_master_bp
    from .api.admin_vehicle_master import admin_vm_bp
    from .api.admin_repair_master import admin_repair_bp

    for bp in (
        auth_bp,
        vehicles_bp,
        policies_bp,
        claims_bp,
        payments_bp,
        ocr_bp,
        ai_bp,
        admin_bp,
        agent_bp,
        files_bp,
        verification_bp,
        vehicle_master_bp,
        admin_vm_bp,
        admin_repair_bp,
    ):
        app.register_blueprint(bp)

    @app.get("/api/health")
    def health():
        return jsonify(
            status="healthy",
            service="CIAS Core API"
        )

    @app.errorhandler(413)
    def too_large(_):
        return jsonify(error="File too large"), 413

    

    return app