<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recetas extends Model
{
    //

    protected $table = "recetas";
    public $timestamps = false;
    
    protected $fillable = [
        'idServicio',
        'fecha',
        'fecha_inicio',
        'fecha_fin',
        'idEmpresa',
        'idCampania',
        'idCampo',
        'nota',
        'idAportante',
        'precio',
        'moneda',
        'idEncargado',
        'idOperario',
        'estado'
    ];
}
