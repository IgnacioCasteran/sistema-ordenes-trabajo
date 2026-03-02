<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class Cereales_servicios_configController extends Controller
{
    public function obtener_etiquetas_activas($servicio) {
        try {
            $tablas = DB::table('tablas')
                        ->where('tipo','=','A')
                        ->where('codigo',$servicio)
                        ->first();

            if ($tablas == null) {
                return [
                    'ok' => false,
                    'msg' => 'El servicio indicado no existe'
                ];
            }

            $config = DB::table('cereales_servicios_config')
                        ->join('tablas', function ($join) {
                                $join->on('cereales_servicios_config.idServicio','=','tablas.codigo')
                                    ->where('tablas.tipo','=','A');
                        })
                        ->join('recetas_parametros','cereales_servicios_config.idRecetaParametro','=','recetas_parametros.id')
                        ->where('cereales_servicios_config.idServicio', $servicio)
                        ->where('cereales_servicios_config.activo','=',1)
                        ->select(
                            'cereales_servicios_config.idServicio AS servicio',
                            DB::raw('TRIM(tablas.nombre) as nombreServicio'),
                            DB::raw('TRIM(recetas_parametros.etiqueta) AS etiqueta'),
                            DB::raw('TRIM(recetas_parametros.campo_recetas_web) AS campo_recetas_web'),
                            'cereales_servicios_config.activo'
                        )
                        ->get();
            return [
                'ok' => true,
                'data' => $config
            ];


        }
        catch (Exception $e) {
            return [
                'ok' => false,
                'msg' => $e->getMessage()
            ];
        }

    }
    
    public function obtener_etiquetas_activas_json($servicio) {
        try {
            $resp = $this->obtener_etiquetas_activas($servicio);
            if (!$resp['ok']) {
                return response()
                        ->json($resp);
            } else {
                $config = $resp['data'];
            }
            return response()
                        ->json([
                            'ok' => true,
                            'data' => $config
                        ]);
        } catch (Exception $e) {
            Log::error('Ha ocurrido un error inesperado: '.$e->getMessage());
            return response()
                    ->json([
                        'ok' => false,
                        'msg' => 'Ha ocurrido un error inesperado'.$e->getMessage()
                    ]);
        }
    }

        public function servicio_tiene_campo_activo($servicio, $campo) {
        try {
            $existe = DB::table('cereales_servicios_config')
                        ->join('recetas_parametros','cereales_servicios_config.idRecetaParametro','=','recetas_parametros.id')
                        ->where('recetas_parametros.campo_recetas_web','=',$campo)
                        ->where('cereales_servicios_config.idServicio','=',$servicio)
                        ->where('cereales_servicios_config.activo','=',1)
                        ->get()
                        ->count() > 0;

            return [
                    'ok' => true,
                    'existe' => $existe
            ];
        }
        catch (Exception $e) {
            Log::error('Ha ocurrido un error inesperado: '.$e->getMessage());
            return [
                    'ok' => false,
                    'msg' => 'Ha ocurrido un error inesperado'.$e->getMessage()
            ];
        }
    }

    public function servicio_tiene_campo_activo_json($servicio, $campo) {
        try {
            $resp = $this->servicio_tiene_campo_activo($servicio, $campo);
            if (!$resp['ok']) {
                return response()
                        ->json($resp);
            } else {
                $existe = $resp['existe'];
            }
            return response()
                        ->json([
                            'ok' => true,
                            'existe' => $existe
                        ]);
            }
        catch (Exception $e) {
            Log::error('Ha ocurrido un error inesperado: '.$e->getMessage());
            return response()
                    ->json([
                        'ok' => false,
                        'msg' => 'Ha ocurrido un error inesperado'.$e->getMessage()
                    ]);
        }
    }
}


