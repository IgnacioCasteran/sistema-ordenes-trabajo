<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recetas_web extends Model
{
    protected $table = "recetas_web";
    public $timestamps = false;

    protected $fillable = [
        'idReceta',
        'fecha_inicio',
        'fecha_fin',
        'tasa_aplicacion',
        'recargas',
        'humedad',
        'viento_velocidad',
        'viento_direccion',
        'rocio',
        'temperatura',
        'nublado',
        'humedad2',
        'profundidad',
        'ancho_trabajo',
        'rastrojo',
        'observaciones_e',
        'observaciones_o'
    ];


}
