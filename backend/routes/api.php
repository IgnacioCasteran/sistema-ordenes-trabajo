<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\RecetasController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Cereales_servicios_configController;
use App\Http\Controllers\Recetas_insumos_webController;
use App\Http\Controllers\Recetas_lotes_webController;
use App\Http\Controllers\Recetas_webController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('registrar',[AuthController::class, 'register']);
Route::post('login',[AuthController::class, 'login']);

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('logout',[AuthController::class, 'logout']);

    Route::get('/recetas', [RecetasController::class, 'index']);
    Route::get('/receta/{id}', [RecetasController::class, 'obtenerReceta']);
    Route::get('/recetas-pendientes', [RecetasController::class, 'recetas_pendientes']);
    Route::post('/receta-asignar-operario', [RecetasController::class, 'asignar_operario']);
    Route::post('/receta-cancelar-asignar-operario', [RecetasController::class, 'cancelar_asignar_operario']);
    Route::post('/receta-enviar-encargado', [RecetasController::class, 'enviar_a_encargado']);
    Route::post('/receta-enviar-sigecom', [RecetasController::class, 'enviar_a_sigecom']);
    Route::post('/receta-devolver-operario', [RecetasController::class, 'devolver_a_operario']);


    Route::post('/receta-web-guardar', [Recetas_webController::class, 'guardar']);
    Route::post('/receta-lotes-web-guardar', [Recetas_lotes_webController::class, 'guardar']);
    Route::post('/receta-insumos-web-guardar', [Recetas_insumos_webController::class, 'guardar']);

    Route::get('/servicio-etiquetas-activas/{servicio}',[Cereales_servicios_configController::class, 'obtener_etiquetas_activas']);
    Route::get('/servicio-tiene-etiqueta-activa/{servicio}/{campo}',[Cereales_servicios_configController::class, 'servicio_tiene_campo_activo_json']);
});

Route::get('usuarios',[AuthController::class, 'getUsuarios']);

//Route::get('/usuarios', [OtUsuariosController::class, 'index']);